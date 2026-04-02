<?php
defined( 'ABSPATH' ) || exit;

/**
 * Server-Sent Events helper.
 * Disables output buffering and sends events in the SSE wire format.
 *
 * Note: WordPress REST API does not natively support SSE.
 * The /stream endpoint calls this directly via a custom WP action,
 * bypassing the normal REST response flow.
 */
class WPAB_SSE_Streamer {

    private bool $started = false;

    /**
     * Set SSE headers and flush any existing output buffers.
     */
    public function start(): void {
        if ( $this->started ) {
            return;
        }

        // Disable PHP time limit for long AI responses
        if ( function_exists( 'set_time_limit' ) ) {
            set_time_limit( 0 );
        }

        // Close session to prevent blocking other requests
        if ( session_status() === PHP_SESSION_ACTIVE ) {
            session_write_close();
        }

        // Clean existing output buffers
        while ( ob_get_level() > 0 ) {
            ob_end_clean();
        }

        header( 'Content-Type: text/event-stream; charset=UTF-8' );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        header( 'X-Accel-Buffering: no' );  // Disable nginx buffering
        header( 'Connection: keep-alive' );
        header( 'Access-Control-Allow-Origin: *' ); // Allow cross-origin

        // Remove any compression
        if ( function_exists( 'apache_setenv' ) ) {
            apache_setenv( 'no-gzip', '1' );
        }
        ini_set( 'zlib.output_compression', '0' );

        $this->started = true;
    }

    /**
     * Send a named SSE event with JSON data.
     */
    public function send( string $event, mixed $data ): void {
        if ( ! $this->started ) {
            $this->start();
        }

        echo "event: {$event}\n";
        echo 'data: ' . wp_json_encode( $data ) . "\n\n";
        flush();
    }

    /**
     * Send a progress/status update.
     */
    public function progress( string $message, int $step = 0, int $total = 0 ): void {
        $this->send( 'progress', [
            'message' => $message,
            'step'    => $step,
            'total'   => $total,
        ] );
    }

    /**
     * Send the final "done" event with the result.
     */
    public function done( array $data ): void {
        $this->send( 'done', $data );
    }

    /**
     * Send an error event.
     */
    public function error( string $message, string $code = 'error' ): void {
        $this->send( 'error', [
            'code'    => $code,
            'message' => $message,
        ] );
    }

    /**
     * Send a keep-alive comment (prevents proxy timeouts).
     */
    public function keep_alive(): void {
        echo ": keep-alive\n\n";
        flush();
    }
}
