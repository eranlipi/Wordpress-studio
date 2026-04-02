<?php
defined( 'ABSPATH' ) || exit;

/**
 * Proxy for AI API calls (Claude Anthropic and Google Gemini).
 * All calls are made server-side using wp_remote_post() so the API key
 * never leaves the server.
 */
class WPAB_AI_Proxy {

    // System prompts
    private const SYSTEM_BUILD = <<<'PROMPT'
You are a WordPress page builder AI. The user will describe a web page or request changes to one.
Your job is to return ONLY the complete HTML for the page body content.
Rules:
- Return ONLY valid HTML — no markdown, no code blocks, no explanation
- Do NOT include <html>, <head>, or <body> tags
- Include a <style> tag at the top with all CSS (use modern, attractive design)
- Use CSS variables for colors and responsive design with media queries
- Make it visually impressive: gradients, shadows, smooth typography
- Use semantic HTML5 elements
PROMPT;

    private const SYSTEM_PLAN = <<<'PROMPT'
You are a WordPress page builder planner. The user will describe a page or website they want to build.
Your job is to return a structured build plan.
Rules:
- Return ONLY raw JSON — no markdown, no code blocks, no explanation
- JSON structure: {"title": "string", "description": "string", "steps": [{"id": number, "title": "string", "description": "string", "type": "hero|header|section|content|footer|gallery|cta"}]}
- Maximum 6 steps
- Each step should be a distinct page section
PROMPT;

    public function __construct( private readonly WPAB_Settings $settings ) {}

    /**
     * Call the active AI provider and return the full response text.
     * Used for planning (non-streaming) and as fallback for /generate.
     */
    public function generate( string $prompt, string $mode = 'build', array $history = [] ): string|WP_Error {
        $provider = $this->settings->get( 'active_provider', 'claude' );
        $api_key  = $this->settings->get_active_key();

        if ( empty( $api_key ) ) {
            return new WP_Error( 'no_api_key', 'No API key configured. Please add your API key in AI Builder settings.', [ 'status' => 400 ] );
        }

        $system = $mode === 'plan' ? self::SYSTEM_PLAN : self::SYSTEM_BUILD;

        return $provider === 'gemini'
            ? $this->call_gemini( $api_key, $prompt, $system, $history )
            : $this->call_claude( $api_key, $prompt, $system, $history );
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
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Build Anthropic-format messages array from conversation history.
     * History items: { role: 'user'|'assistant', content: string }
     */
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

    /**
     * Build Gemini-format contents array.
     */
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

    /**
     * Get the available models for each provider.
     */
    public static function get_models(): array {
        return [
            'claude' => [
                [ 'id' => 'claude-sonnet-4-6',       'name' => 'Claude Sonnet 4.6 (Recommended)' ],
                [ 'id' => 'claude-opus-4-6',          'name' => 'Claude Opus 4.6' ],
                [ 'id' => 'claude-haiku-4-5-20251001','name' => 'Claude Haiku 4.5 (Fast)' ],
            ],
            'gemini' => [
                [ 'id' => 'gemini-2.0-flash',         'name' => 'Gemini 2.0 Flash (Recommended)' ],
                [ 'id' => 'gemini-1.5-pro',           'name' => 'Gemini 1.5 Pro' ],
                [ 'id' => 'gemini-1.5-flash',         'name' => 'Gemini 1.5 Flash (Fast)' ],
            ],
        ];
    }
}
