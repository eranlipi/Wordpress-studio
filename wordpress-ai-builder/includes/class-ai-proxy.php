<?php
defined( 'ABSPATH' ) || exit;

/**
 * Proxy for AI API calls (Claude Anthropic and Google Gemini).
 * All calls are made server-side using wp_remote_post() so the API key
 * never leaves the server.
 */
class WPAB_AI_Proxy {

    // -------------------------------------------------------------------------
    // System Prompts
    // -------------------------------------------------------------------------

    /** Used when building a brand-new page (no existing HTML). */
    private const SYSTEM_CREATE = <<<'PROMPT'
You are a WordPress page builder AI. The user wants to create a new web page.
Return ONLY the complete HTML for the page body content.
Rules:
- Return ONLY valid HTML — no markdown, no code blocks, no explanation
- Do NOT include <html>, <head>, or <body> tags
- Include a <style> tag at the top with all CSS
- Use CSS variables for colors and responsive design with media queries
- Make it visually impressive: gradients, shadows, smooth typography
- Use semantic HTML5 elements
- Build ALL sections the user mentions in one response
PROMPT;

    /**
     * Used when editing an existing page.
     * The current HTML is injected into the user message as context.
     */
    private const SYSTEM_EDIT = <<<'PROMPT'
You are a WordPress page editor AI. The user wants to modify an existing page.
You will receive the CURRENT HTML of the page and an edit instruction.
Return the COMPLETE updated HTML for the entire page — not just the changed section.
Rules:
- Return ONLY valid HTML — no markdown, no code blocks, no explanation
- Do NOT include <html>, <head>, or <body> tags
- Keep all existing sections unless the user asks to remove them
- Preserve the overall design language unless changing style is the request
- Update the <style> tag to reflect any style changes
- For style changes: update colors/fonts across the whole page consistently
- For section edits: modify only the relevant section, keep others intact
- For new sections: add them in a logical position
PROMPT;

    /** Used only for generating a short page title. */
    private const SYSTEM_TITLE = <<<'PROMPT'
You are a page title generator. Given a description of a web page, return ONLY a short, clean page title (2–6 words). No punctuation at the end. No quotes. No explanation.
PROMPT;

    /** Used for planning mode. */
    private const SYSTEM_PLAN = <<<'PROMPT'
You are a WordPress page builder planner. The user will describe a page or website they want to build.
Your job is to return a structured build plan.
Rules:
- Return ONLY raw JSON — no markdown, no code blocks, no explanation
- JSON structure: {"title": "string", "description": "string", "steps": [{"id": number, "title": "string", "description": "string", "type": "hero|header|section|content|footer|gallery|cta"}]}
- Maximum 6 steps
- Each step should be a distinct page section
PROMPT;

    // -------------------------------------------------------------------------
    // Intent types
    // -------------------------------------------------------------------------

    /** Intent values returned by detect_intent(). */
    public const INTENT_CREATE       = 'create';       // No existing page
    public const INTENT_FULL_REBUILD = 'full_rebuild'; // User wants to start over
    public const INTENT_EDIT_STYLE   = 'edit_style';   // Color, font, theme changes
    public const INTENT_EDIT_SECTION = 'edit_section'; // Modify a specific section
    public const INTENT_ADD_SECTION  = 'add_section';  // Add new content/section
    public const INTENT_FIX          = 'fix';          // Fix something broken/wrong

    public function __construct( private readonly WPAB_Settings $settings ) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Main generation entry point.
     *
     * @param string $prompt       The user's request.
     * @param string $mode         'build' | 'plan' | 'title'
     * @param array  $history      Conversation history [{role, content}]
     * @param string $current_html Current page HTML (empty string = new page)
     */
    public function generate(
        string $prompt,
        string $mode = 'build',
        array $history = [],
        string $current_html = ''
    ): string|WP_Error {
        $provider = $this->settings->get( 'active_provider', 'claude' );
        $api_key  = $this->settings->get_active_key();

        if ( empty( $api_key ) ) {
            return new WP_Error(
                'no_api_key',
                'No API key configured. Please add your API key in AI Builder settings.',
                [ 'status' => 400 ]
            );
        }

        $system        = $this->pick_system_prompt( $mode, $current_html );
        $full_prompt   = $this->build_full_prompt( $prompt, $mode, $current_html );

        return $provider === 'gemini'
            ? $this->call_gemini( $api_key, $full_prompt, $system, $history )
            : $this->call_claude( $api_key, $full_prompt, $system, $history );
    }

    /**
     * Detect the user's edit intent from their prompt and whether a page exists.
     * Returns one of the INTENT_* constants.
     */
    public function detect_intent( string $prompt, bool $has_existing_page ): string {
        if ( ! $has_existing_page ) {
            return self::INTENT_CREATE;
        }

        $lower = strtolower( $prompt );

        // Full rebuild signals
        if ( preg_match( '/\b(rebuild|redo|start over|from scratch|completely new|scrap|delete everything|new design)\b/', $lower ) ) {
            return self::INTENT_FULL_REBUILD;
        }

        // Fix signals
        if ( preg_match( '/\b(fix|broken|not working|looks wrong|error|issue|problem|weird|bad|ugly)\b/', $lower ) ) {
            return self::INTENT_FIX;
        }

        // Style signals
        if ( preg_match( '/\b(color|colour|font|background|dark mode|light mode|theme|palette|gradient|shadow|border|spacing|padding|margin|size|width|height|style|look|feel|design)\b/', $lower ) ) {
            return self::INTENT_EDIT_STYLE;
        }

        // Add section signals
        if ( preg_match( '/\b(add|insert|include|append|create a new section|new section|missing)\b/', $lower ) ) {
            return self::INTENT_ADD_SECTION;
        }

        // Specific section edit
        if ( preg_match( '/\b(hero|header|footer|nav|navigation|about|contact|feature|pricing|testimonial|gallery|cta|button|form|image|text|heading|title|subtitle|paragraph)\b/', $lower ) ) {
            return self::INTENT_EDIT_SECTION;
        }

        // Default: treat as a section edit
        return self::INTENT_EDIT_SECTION;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function pick_system_prompt( string $mode, string $current_html ): string {
        return match ( $mode ) {
            'plan'  => self::SYSTEM_PLAN,
            'title' => self::SYSTEM_TITLE,
            default => empty( $current_html ) ? self::SYSTEM_CREATE : self::SYSTEM_EDIT,
        };
    }

    /**
     * For edit mode, prepend the current HTML as context in the user message.
     */
    private function build_full_prompt( string $prompt, string $mode, string $current_html ): string {
        if ( $mode !== 'build' || empty( $current_html ) ) {
            return $prompt;
        }

        // Truncate current HTML to avoid token limits (keep ~40k chars ≈ ~10k tokens)
        $max_html_chars = 40000;
        $html_context   = strlen( $current_html ) > $max_html_chars
            ? substr( $current_html, 0, $max_html_chars ) . "\n<!-- [truncated for brevity] -->"
            : $current_html;

        return <<<PROMPT
CURRENT PAGE HTML:
```html
{$html_context}
```

USER REQUEST:
{$prompt}
PROMPT;
    }

    // -------------------------------------------------------------------------
    // Claude (Anthropic)
    // -------------------------------------------------------------------------

    private function call_claude( string $api_key, string $prompt, string $system, array $history ): string|WP_Error {
        $model    = $this->settings->get( 'active_model', 'claude-sonnet-4-6' );
        $messages = $this->build_message_history( $history, $prompt );

        $response = wp_remote_post( 'https://api.anthropic.com/v1/messages', [
            'timeout' => 120,
            'headers' => [
                'x-api-key'         => $api_key,
                'anthropic-version' => '2023-06-01',
                'content-type'      => 'application/json',
            ],
            'body' => wp_json_encode( [
                'model'      => $model,
                'max_tokens' => 8192,
                'system'     => $system,
                'messages'   => $messages,
            ] ),
        ] );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 200 ) {
            $error_msg = $body['error']['message'] ?? "Claude API error (HTTP {$code})";
            return new WP_Error( 'claude_error', $error_msg, [ 'status' => 502 ] );
        }

        return $body['content'][0]['text'] ?? '';
    }

    // -------------------------------------------------------------------------
    // Gemini (Google)
    // -------------------------------------------------------------------------

    private function call_gemini( string $api_key, string $prompt, string $system, array $history ): string|WP_Error {
        $model    = $this->settings->get( 'active_model', 'gemini-2.0-flash' );
        $contents = $this->build_gemini_contents( $history, $prompt );

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$api_key}";

        $response = wp_remote_post( $url, [
            'timeout' => 120,
            'headers' => [ 'content-type' => 'application/json' ],
            'body'    => wp_json_encode( [
                'system_instruction' => [ 'parts' => [ [ 'text' => $system ] ] ],
                'contents'           => $contents,
                'generationConfig'   => [ 'maxOutputTokens' => 8192 ],
            ] ),
        ] );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 200 ) {
            $error_msg = $body['error']['message'] ?? "Gemini API error (HTTP {$code})";
            return new WP_Error( 'gemini_error', $error_msg, [ 'status' => 502 ] );
        }

        return $body['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    // -------------------------------------------------------------------------
    // Message history formatters
    // -------------------------------------------------------------------------

    private function build_message_history( array $history, string $new_prompt ): array {
        $messages = [];

        foreach ( $history as $item ) {
            if ( ! empty( $item['role'] ) && ! empty( $item['content'] ) ) {
                $messages[] = [
                    'role'    => $item['role'] === 'assistant' ? 'assistant' : 'user',
                    'content' => (string) $item['content'],
                ];
            }
        }

        $messages[] = [ 'role' => 'user', 'content' => $new_prompt ];

        return $messages;
    }

    private function build_gemini_contents( array $history, string $new_prompt ): array {
        $contents = [];

        foreach ( $history as $item ) {
            if ( ! empty( $item['role'] ) && ! empty( $item['content'] ) ) {
                $contents[] = [
                    'role'  => $item['role'] === 'assistant' ? 'model' : 'user',
                    'parts' => [ [ 'text' => (string) $item['content'] ] ],
                ];
            }
        }

        $contents[] = [ 'role' => 'user', 'parts' => [ [ 'text' => $new_prompt ] ] ];

        return $contents;
    }

    // -------------------------------------------------------------------------
    // Models
    // -------------------------------------------------------------------------

    public static function get_models(): array {
        return [
            'claude' => [
                [ 'id' => 'claude-sonnet-4-6',        'name' => 'Claude Sonnet 4.6 (Recommended)' ],
                [ 'id' => 'claude-opus-4-6',           'name' => 'Claude Opus 4.6' ],
                [ 'id' => 'claude-haiku-4-5-20251001', 'name' => 'Claude Haiku 4.5 (Fast)' ],
            ],
            'gemini' => [
                [ 'id' => 'gemini-2.0-flash', 'name' => 'Gemini 2.0 Flash (Recommended)' ],
                [ 'id' => 'gemini-1.5-pro',   'name' => 'Gemini 1.5 Pro' ],
                [ 'id' => 'gemini-1.5-flash', 'name' => 'Gemini 1.5 Flash (Fast)' ],
            ],
        ];
    }
}
