<?php
/**
 * Plugin Name: WordPress AI Builder
 * Plugin URI:  https://github.com/eranlipi/wordpress-studio
 * Description: AI-powered page builder using Claude Sonnet or Gemini. Chat with AI to build WordPress pages with live preview.
 * Version:     0.1.0
 * Author:      WordPress AI Builder
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * Text Domain: wordpress-ai-builder
 */

defined( 'ABSPATH' ) || exit;

define( 'WPAB_VERSION',     '0.1.0' );
define( 'WPAB_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'WPAB_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'WPAB_BUILD_DIR',   WPAB_PLUGIN_DIR . 'build/' );
define( 'WPAB_BUILD_URL',   WPAB_PLUGIN_URL . 'build/' );

// Autoload includes
foreach ( [
    'class-settings',
    'class-page-manager',
    'class-ai-proxy',
    'class-sse-streamer',
    'class-rest-controller',
    'class-admin',
    'class-plugin',
] as $file ) {
    require_once WPAB_PLUGIN_DIR . "includes/{$file}.php";
}

add_action( 'plugins_loaded', [ 'WPAB_Plugin', 'get_instance' ] );
register_activation_hook( __FILE__,   [ 'WPAB_Plugin', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'WPAB_Plugin', 'deactivate' ] );
