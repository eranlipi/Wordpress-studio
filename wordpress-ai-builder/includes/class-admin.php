<?php
defined( 'ABSPATH' ) || exit;

/**
 * Registers the full-screen admin page and enqueues the compiled React app.
 */
class WPAB_Admin {

    public function add_admin_page(): void {
        add_menu_page(
            __( 'AI Builder', 'wordpress-ai-builder' ),
            __( 'AI Builder', 'wordpress-ai-builder' ),
            'edit_pages',
            'wordpress-ai-builder',
            [ $this, 'render_app_shell' ],
            'dashicons-superhero',
            3
        );
    }

    public function render_app_shell(): void {
        $nonce    = wp_create_nonce( 'wpab_rest' );
        $rest_url = esc_url_raw( rest_url( 'wpab/v1' ) );
        $site_url = esc_url_raw( home_url() );
        printf(
            '<div id="wpab-root" data-nonce="%s" data-rest-url="%s" data-site-url="%s"></div>',
            esc_attr( $nonce ),
            esc_attr( $rest_url ),
            esc_attr( $site_url )
        );
    }

    public function enqueue_assets( string $hook ): void {
        if ( 'toplevel_page_wordpress-ai-builder' !== $hook ) {
            return;
        }

        $manifest_path = WPAB_BUILD_DIR . '.vite/manifest.json';

        if ( ! file_exists( $manifest_path ) ) {
            // Dev mode fallback message
            add_action( 'admin_notices', function () {
                echo '<div class="notice notice-warning"><p><strong>AI Builder:</strong> Please run <code>npm run build</code> inside the <code>src/</code> folder to compile the UI.</p></div>';
            } );
            return;
        }

        $manifest = json_decode( file_get_contents( $manifest_path ), true );
        $entry    = $manifest['src/main.tsx'] ?? null;

        if ( ! $entry ) {
            return;
        }

        wp_enqueue_script(
            'wpab-app',
            WPAB_BUILD_URL . $entry['file'],
            [],
            WPAB_VERSION,
            true
        );

        if ( ! empty( $entry['css'] ) ) {
            foreach ( $entry['css'] as $i => $css_file ) {
                wp_enqueue_style(
                    "wpab-app-css-{$i}",
                    WPAB_BUILD_URL . $css_file,
                    [],
                    WPAB_VERSION
                );
            }
        }

        // Make the admin page full-screen by hiding WP chrome
        add_action( 'admin_head', [ $this, 'inject_fullscreen_styles' ] );
    }

    public function inject_fullscreen_styles(): void {
        // Load Tailwind CSS for the React app
        echo '<script src="https://cdn.tailwindcss.com"></script>';
        echo '<style>
            #wpcontent, #wpbody-content { padding: 0 !important; margin: 0 !important; }
            #wpab-root { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; background: #fff; }
            #wpadminbar, #adminmenuwrap, #adminmenuback { display: none !important; }
            html.wp-toolbar { padding-top: 0 !important; }
        </style>';
    }
}
