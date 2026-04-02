<?php
defined( 'ABSPATH' ) || exit;

/**
 * Registers all wpab/v1 REST API routes.
 *
 * Security:
 * - Every route requires the user to be logged in with edit_pages capability
 * - Mutating routes verify the wpab_rest nonce from the X-WP-Nonce header
 *   (WordPress REST API handles this automatically via the cookie auth)
 */
class WPAB_REST_Controller {

    private const NAMESPACE = 'wpab/v1';

    public function __construct(
        private readonly WPAB_Settings     $settings,
        private readonly WPAB_Page_Manager $page_manager,
        private readonly WPAB_AI_Proxy     $ai_proxy
    ) {}

    public function register_routes(): void {
        $ns   = self::NAMESPACE;
        $auth = [ $this, 'check_permission' ];

        // Settings
        register_rest_route( $ns, '/settings', [
            [ 'methods' => WP_REST_Server::READABLE,  'callback' => [ $this, 'get_settings' ],  'permission_callback' => $auth ],
            [ 'methods' => WP_REST_Server::CREATABLE,  'callback' => [ $this, 'save_settings' ], 'permission_callback' => $auth ],
        ] );

        // Available models
        register_rest_route( $ns, '/models', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'get_models' ],
            'permission_callback' => $auth,
        ] );

        // Pages list
        register_rest_route( $ns, '/pages', [
            [ 'methods' => WP_REST_Server::READABLE,  'callback' => [ $this, 'list_pages' ],   'permission_callback' => $auth ],
            [ 'methods' => WP_REST_Server::CREATABLE,  'callback' => [ $this, 'create_page' ],  'permission_callback' => $auth ],
        ] );

        // Single page operations
        register_rest_route( $ns, '/pages/(?P<id>\d+)', [
            [ 'methods' => WP_REST_Server::EDITABLE, 'callback' => [ $this, 'update_page' ], 'permission_callback' => $auth ],
        ] );

        register_rest_route( $ns, '/pages/(?P<id>\d+)/publish', [
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => [ $this, 'publish_page' ],
            'permission_callback' => $auth,
        ] );

        register_rest_route( $ns, '/pages/(?P<id>\d+)/preview-url', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'get_preview_url' ],
            'permission_callback' => $auth,
        ] );

        // AI generation (non-streaming — for simpler environments)
        register_rest_route( $ns, '/generate', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'generate' ],
            'permission_callback' => $auth,
        ] );

        // Auto title suggestion for a new page
        register_rest_route( $ns, '/title', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'suggest_title' ],
            'permission_callback' => $auth,
        ] );

        // Planning
        register_rest_route( $ns, '/plan', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'create_plan' ],
            'permission_callback' => $auth,
        ] );

        register_rest_route( $ns, '/plan/execute', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'execute_plan' ],
            'permission_callback' => $auth,
        ] );

        // SSE streaming endpoint (handles its own output)
        register_rest_route( $ns, '/stream', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'stream' ],
            'permission_callback' => $auth,
        ] );
    }

    // -------------------------------------------------------------------------
    // Permission
    // -------------------------------------------------------------------------

    public function check_permission( WP_REST_Request $request ): bool|WP_Error {
        if ( ! is_user_logged_in() ) {
            return new WP_Error( 'rest_forbidden', 'You must be logged in.', [ 'status' => 401 ] );
        }
        if ( ! current_user_can( 'edit_pages' ) ) {
            return new WP_Error( 'rest_forbidden', 'Insufficient permissions.', [ 'status' => 403 ] );
        }
        return true;
    }

    // -------------------------------------------------------------------------
    // Settings
    // -------------------------------------------------------------------------

    public function get_settings( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( $this->settings->get_public() );
    }

    public function save_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        if ( ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( 'rest_forbidden', 'Only admins can change settings.', [ 'status' => 403 ] );
        }

        $data = $request->get_json_params() ?? $request->get_params();
        $this->settings->save( $data );

        return rest_ensure_response( [ 'success' => true, 'settings' => $this->settings->get_public() ] );
    }

    // -------------------------------------------------------------------------
    // Models
    // -------------------------------------------------------------------------

    public function get_models( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( WPAB_AI_Proxy::get_models() );
    }

    // -------------------------------------------------------------------------
    // Pages
    // -------------------------------------------------------------------------

    public function list_pages( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( $this->page_manager->list_pages() );
    }

    public function create_page( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $params = $request->get_json_params() ?? [];
        $title  = sanitize_text_field( $params['title'] ?? 'AI Builder Page' );
        $result = $this->page_manager->create_draft( $title );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        $this->page_manager->mark_as_generated( $result['post_id'] );

        return rest_ensure_response( $result );
    }

    public function update_page( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $post_id = (int) $request->get_param( 'id' );
        $params  = $request->get_json_params() ?? [];
        $html    = $params['html'] ?? '';

        if ( empty( $html ) ) {
            return new WP_Error( 'missing_html', 'HTML content is required.', [ 'status' => 400 ] );
        }

        $clean_html = wp_kses_post( $html );
        $result     = $this->page_manager->update_content( $post_id, $clean_html );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        if ( isset( $params['title'] ) && ! empty( $params['title'] ) ) {
            $this->page_manager->update_title( $post_id, $params['title'] );
        }

        return rest_ensure_response( $result );
    }

    public function publish_page( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $post_id = (int) $request->get_param( 'id' );
        $result  = $this->page_manager->publish( $post_id );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    public function get_preview_url( WP_REST_Request $request ): WP_REST_Response {
        $post_id = (int) $request->get_param( 'id' );
        return rest_ensure_response( [
            'post_id'     => $post_id,
            'preview_url' => $this->page_manager->get_preview_url( $post_id ),
        ] );
    }

    // -------------------------------------------------------------------------
    // Auto title suggestion
    // -------------------------------------------------------------------------

    public function suggest_title( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $params = $request->get_json_params() ?? [];
        $prompt = sanitize_textarea_field( $params['prompt'] ?? '' );

        if ( empty( $prompt ) ) {
            return new WP_Error( 'missing_prompt', 'Prompt is required.', [ 'status' => 400 ] );
        }

        $title = $this->ai_proxy->generate( $prompt, 'title' );

        if ( is_wp_error( $title ) ) {
            // Non-critical — return a fallback instead of erroring
            return rest_ensure_response( [ 'title' => 'AI Builder Page' ] );
        }

        return rest_ensure_response( [ 'title' => sanitize_text_field( trim( $title ) ) ] );
    }

    // -------------------------------------------------------------------------
    // AI Generation (non-streaming)
    // -------------------------------------------------------------------------

    public function generate( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $params  = $request->get_json_params() ?? [];
        $prompt  = sanitize_textarea_field( $params['prompt'] ?? '' );
        $post_id = (int) ( $params['post_id'] ?? 0 );
        $history = (array) ( $params['history'] ?? [] );

        if ( empty( $prompt ) ) {
            return new WP_Error( 'missing_prompt', 'Prompt is required.', [ 'status' => 400 ] );
        }

        // Fetch current HTML for context-aware editing
        $current_html = $post_id > 0 ? $this->page_manager->get_raw_html( $post_id ) : '';

        // Detect intent
        $intent = $this->ai_proxy->detect_intent( $prompt, ! empty( $current_html ) );

        // Full rebuild: clear context so the CREATE prompt is used
        if ( $intent === WPAB_AI_Proxy::INTENT_FULL_REBUILD ) {
            $current_html = '';
        }

        $html = $this->ai_proxy->generate( $prompt, 'build', $history, $current_html );

        if ( is_wp_error( $html ) ) {
            return $html;
        }

        $clean_html = wp_kses_post( $html );

        if ( $post_id > 0 ) {
            $result = $this->page_manager->update_content( $post_id, $clean_html );
        } else {
            $result = $this->page_manager->create_draft();
            if ( ! is_wp_error( $result ) ) {
                $this->page_manager->mark_as_generated( $result['post_id'] );
                $result = $this->page_manager->update_content( $result['post_id'], $clean_html );
            }
        }

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( array_merge( $result, [
            'html'   => $clean_html,
            'intent' => $intent,
        ] ) );
    }

    // -------------------------------------------------------------------------
    // Planning
    // -------------------------------------------------------------------------

    public function create_plan( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $params = $request->get_json_params() ?? [];
        $prompt = sanitize_textarea_field( $params['prompt'] ?? '' );

        if ( empty( $prompt ) ) {
            return new WP_Error( 'missing_prompt', 'Prompt is required.', [ 'status' => 400 ] );
        }

        $raw = $this->ai_proxy->generate( $prompt, 'plan' );

        if ( is_wp_error( $raw ) ) {
            return $raw;
        }

        $json_str = preg_replace( '/^```(?:json)?\s*/m', '', trim( $raw ) );
        $json_str = preg_replace( '/```\s*$/m', '', $json_str );
        $plan     = json_decode( trim( $json_str ), true );

        if ( json_last_error() !== JSON_ERROR_NONE || empty( $plan['steps'] ) ) {
            return new WP_Error( 'invalid_plan', 'AI returned invalid plan JSON. Response: ' . substr( $raw, 0, 200 ), [ 'status' => 502 ] );
        }

        $plan['title']       = sanitize_text_field( $plan['title'] ?? 'Page Plan' );
        $plan['description'] = sanitize_textarea_field( $plan['description'] ?? '' );
        $plan['steps']       = array_map( function ( $step ) {
            return [
                'id'          => (int) ( $step['id'] ?? 0 ),
                'title'       => sanitize_text_field( $step['title'] ?? '' ),
                'description' => sanitize_textarea_field( $step['description'] ?? '' ),
                'type'        => sanitize_text_field( $step['type'] ?? 'section' ),
            ];
        }, array_slice( $plan['steps'], 0, 6 ) );

        return rest_ensure_response( $plan );
    }

    public function execute_plan( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $params  = $request->get_json_params() ?? [];
        $plan    = $params['plan'] ?? null;
        $post_id = (int) ( $params['post_id'] ?? 0 );

        if ( empty( $plan ) || empty( $plan['steps'] ) ) {
            return new WP_Error( 'missing_plan', 'Plan is required.', [ 'status' => 400 ] );
        }

        if ( $post_id === 0 ) {
            $page_result = $this->page_manager->create_draft( $plan['title'] ?? 'AI Builder Page' );
            if ( is_wp_error( $page_result ) ) {
                return $page_result;
            }
            $post_id = $page_result['post_id'];
            $this->page_manager->mark_as_generated( $post_id );
        }

        $full_prompt = "Build a complete webpage with these sections:\n";
        foreach ( $plan['steps'] as $step ) {
            $full_prompt .= "- {$step['type']}: {$step['title']} — {$step['description']}\n";
        }
        $full_prompt .= "\nPage title: " . ( $plan['title'] ?? 'Page' );

        // For plan execution, always create fresh (no current HTML context)
        $html = $this->ai_proxy->generate( $full_prompt, 'build', [], '' );

        if ( is_wp_error( $html ) ) {
            return $html;
        }

        $clean_html = wp_kses_post( $html );
        $result     = $this->page_manager->update_content( $post_id, $clean_html );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        if ( ! empty( $plan['title'] ) ) {
            $this->page_manager->update_title( $post_id, $plan['title'] );
        }

        return rest_ensure_response( array_merge( $result, [
            'html'    => $clean_html,
            'post_id' => $post_id,
            'intent'  => WPAB_AI_Proxy::INTENT_CREATE,
        ] ) );
    }

    // -------------------------------------------------------------------------
    // SSE Streaming
    // -------------------------------------------------------------------------

    public function stream( WP_REST_Request $request ): void {
        $params  = $request->get_json_params() ?? [];
        $prompt  = sanitize_textarea_field( $params['prompt'] ?? '' );
        $post_id = (int) ( $params['post_id'] ?? 0 );
        $history = (array) ( $params['history'] ?? [] );
        $mode    = sanitize_text_field( $params['mode'] ?? 'build' );

        $streamer = new WPAB_SSE_Streamer();
        $streamer->start();

        if ( empty( $prompt ) ) {
            $streamer->error( 'Prompt is required.', 'missing_prompt' );
            exit;
        }

        $streamer->progress( 'Analyzing request...' );

        if ( $mode === 'plan' ) {
            $raw = $this->ai_proxy->generate( $prompt, 'plan', $history );

            if ( is_wp_error( $raw ) ) {
                $streamer->error( $raw->get_error_message(), $raw->get_error_code() );
                exit;
            }

            $json_str = preg_replace( '/^```(?:json)?\s*/m', '', trim( $raw ) );
            $json_str = preg_replace( '/```\s*$/m', '', $json_str );
            $plan     = json_decode( trim( $json_str ), true );

            if ( json_last_error() !== JSON_ERROR_NONE ) {
                $streamer->error( 'Invalid plan JSON returned.', 'invalid_plan' );
                exit;
            }

            $streamer->done( [ 'type' => 'plan', 'plan' => $plan ] );
            exit;
        }

        // Build mode — detect intent and fetch current HTML for context
        $current_html = $post_id > 0 ? $this->page_manager->get_raw_html( $post_id ) : '';
        $intent       = $this->ai_proxy->detect_intent( $prompt, ! empty( $current_html ) );

        // Full rebuild: clear context
        if ( $intent === WPAB_AI_Proxy::INTENT_FULL_REBUILD ) {
            $current_html = '';
        }

        // Send intent to frontend immediately so UI can update
        $streamer->send( 'intent', [ 'intent' => $intent ] );

        // Map intent to a friendly status message
        $status_messages = [
            WPAB_AI_Proxy::INTENT_CREATE       => 'Building your page...',
            WPAB_AI_Proxy::INTENT_FULL_REBUILD => 'Rebuilding page from scratch...',
            WPAB_AI_Proxy::INTENT_EDIT_STYLE   => 'Updating styles...',
            WPAB_AI_Proxy::INTENT_EDIT_SECTION => 'Editing section...',
            WPAB_AI_Proxy::INTENT_ADD_SECTION  => 'Adding new section...',
            WPAB_AI_Proxy::INTENT_FIX          => 'Fixing issue...',
        ];
        $streamer->progress( $status_messages[ $intent ] ?? 'Generating...' );

        $result = $this->ai_proxy->generate( $prompt, 'build', $history, $current_html );

        if ( is_wp_error( $result ) ) {
            $streamer->error( $result->get_error_message(), $result->get_error_code() );
            exit;
        }

        $streamer->progress( 'Saving page...' );
        $clean_html = wp_kses_post( $result );

        if ( $post_id > 0 ) {
            $page_result = $this->page_manager->update_content( $post_id, $clean_html );
        } else {
            $page_result = $this->page_manager->create_draft();
            if ( ! is_wp_error( $page_result ) ) {
                $post_id = $page_result['post_id'];
                $this->page_manager->mark_as_generated( $post_id );
                $page_result = $this->page_manager->update_content( $post_id, $clean_html );
            }
        }

        if ( is_wp_error( $page_result ) ) {
            $streamer->error( $page_result->get_error_message(), $page_result->get_error_code() );
            exit;
        }

        $streamer->done( [
            'type'        => 'build',
            'html'        => $clean_html,
            'post_id'     => $page_result['post_id'],
            'preview_url' => $page_result['preview_url'],
            'intent'      => $intent,
        ] );
        exit;
    }
}
