<?php
defined( 'ABSPATH' ) || exit;

/**
 * Singleton orchestrator – hooks everything together on plugins_loaded.
 */
class WPAB_Plugin {

    private static ?self $instance = null;

    private WPAB_Settings         $settings;
    private WPAB_Page_Manager     $page_manager;
    private WPAB_AI_Proxy         $ai_proxy;
    private WPAB_REST_Controller  $rest;
    private WPAB_Admin            $admin;

    private function __construct() {
        $this->settings     = new WPAB_Settings();
        $this->page_manager = new WPAB_Page_Manager();
        $this->ai_proxy     = new WPAB_AI_Proxy( $this->settings );
        $this->rest         = new WPAB_REST_Controller( $this->settings, $this->page_manager, $this->ai_proxy );
        $this->admin        = new WPAB_Admin();

        add_action( 'rest_api_init', [ $this->rest, 'register_routes' ] );
        add_action( 'admin_menu',    [ $this->admin, 'add_admin_page' ] );
        add_action( 'admin_enqueue_scripts', [ $this->admin, 'enqueue_assets' ] );
    }

    public static function get_instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function activate(): void {
        flush_rewrite_rules();
    }

    public static function deactivate(): void {
        flush_rewrite_rules();
    }
}
