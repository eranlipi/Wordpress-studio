<?php
defined( 'ABSPATH' ) || exit;

/**
 * Typed wrapper around the WordPress Options API for plugin settings.
 * API keys are stored in the database; only masked values are returned to the frontend.
 */
class WPAB_Settings {

    private const OPTION_KEY = 'wpab_settings';

    private const ALLOWED_FIELDS = [
        'claude_api_key',
        'gemini_api_key',
        'active_provider',
        'active_model',
    ];

    public function get( string $key, mixed $default = null ): mixed {
        $settings = get_option( self::OPTION_KEY, [] );
        return $settings[ $key ] ?? $default;
    }

    /**
     * Save allowed fields (sanitizes all values).
     */
    public function save( array $data ): bool {
        $current   = get_option( self::OPTION_KEY, [] );
        $sanitized = $current;

        foreach ( self::ALLOWED_FIELDS as $field ) {
            if ( array_key_exists( $field, $data ) ) {
                $sanitized[ $field ] = sanitize_text_field( $data[ $field ] );
            }
        }

        return update_option( self::OPTION_KEY, $sanitized );
    }

    /**
     * Return the active API key (raw, for server-side use only).
     */
    public function get_active_key(): string {
        $provider = $this->get( 'active_provider', 'claude' );
        $key      = $provider === 'gemini'
            ? $this->get( 'gemini_api_key', '' )
            : $this->get( 'claude_api_key', '' );

        return (string) $key;
    }

    /**
     * Return settings safe for the frontend (keys masked).
     */
    public function get_public(): array {
        $provider       = $this->get( 'active_provider', 'claude' );
        $active_model   = $this->get( 'active_model', 'claude-sonnet-4-6' );
        $claude_key     = (string) $this->get( 'claude_api_key', '' );
        $gemini_key     = (string) $this->get( 'gemini_api_key', '' );

        return [
            'active_provider'    => $provider,
            'active_model'       => $active_model,
            'has_claude_key'     => ! empty( $claude_key ),
            'has_gemini_key'     => ! empty( $gemini_key ),
            'claude_key_masked'  => $this->mask_key( $claude_key ),
            'gemini_key_masked'  => $this->mask_key( $gemini_key ),
        ];
    }

    private function mask_key( string $key ): string {
        if ( strlen( $key ) < 8 ) {
            return $key ? '****' : '';
        }
        return substr( $key, 0, 7 ) . str_repeat( '*', max( 0, strlen( $key ) - 11 ) ) . substr( $key, -4 );
    }
}
