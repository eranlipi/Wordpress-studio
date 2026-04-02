<?php
defined( 'ABSPATH' ) || exit;

/**
 * Wraps WordPress post operations for AI-generated pages.
 */
class WPAB_Page_Manager {

    /**
     * Create a new draft page, return its ID and preview URL.
     *
     * @return array{ post_id: int, preview_url: string }|WP_Error
     */
    public function create_draft( string $title = 'AI Builder Draft' ): array|WP_Error {
        $post_id = wp_insert_post( [
            'post_title'   => sanitize_text_field( $title ),
            'post_content' => '',
            'post_type'    => 'page',
            'post_status'  => 'draft',
            'post_author'  => get_current_user_id(),
        ], true );

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        return [
            'post_id'     => $post_id,
            'preview_url' => $this->get_preview_url( $post_id ),
            'edit_url'    => get_edit_post_link( $post_id, 'raw' ),
        ];
    }

    /**
     * Update page HTML content (wrapped in a raw HTML block).
     *
     * @return array{ post_id: int, preview_url: string }|WP_Error
     */
    public function update_content( int $post_id, string $html ): array|WP_Error {
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return new WP_Error( 'forbidden', 'Cannot edit this post.', [ 'status' => 403 ] );
        }

        $block_content = "<!-- wp:html -->\n" . $html . "\n<!-- /wp:html -->";

        $result = wp_update_post( [
            'ID'           => $post_id,
            'post_content' => $block_content,
        ], true );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return [
            'post_id'     => $post_id,
            'preview_url' => $this->get_preview_url( $post_id ),
        ];
    }

    /**
     * Publish a draft page.
     *
     * @return array{ post_id: int, permalink: string }|WP_Error
     */
    public function publish( int $post_id ): array|WP_Error {
        if ( ! current_user_can( 'publish_posts' ) ) {
            return new WP_Error( 'forbidden', 'Cannot publish posts.', [ 'status' => 403 ] );
        }

        $result = wp_update_post( [
            'ID'          => $post_id,
            'post_status' => 'publish',
        ], true );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return [
            'post_id'   => $post_id,
            'permalink' => get_permalink( $post_id ),
        ];
    }

    /**
     * Get the preview URL for a draft post (authenticated).
     */
    public function get_preview_url( int $post_id ): string {
        $post = get_post( $post_id );
        if ( ! $post ) {
            return '';
        }

        if ( $post->post_status === 'publish' ) {
            return (string) get_permalink( $post_id );
        }

        return (string) get_preview_post_link( $post_id );
    }

    /**
     * Get a list of pages created by the AI Builder (for the "pages" sidebar).
     */
    public function list_pages( int $limit = 20 ): array {
        $posts = get_posts( [
            'post_type'      => 'page',
            'post_status'    => [ 'draft', 'publish', 'private' ],
            'posts_per_page' => $limit,
            'orderby'        => 'modified',
            'order'          => 'DESC',
            'meta_query'     => [
                [
                    'key'     => '_wpab_generated',
                    'compare' => 'EXISTS',
                ],
            ],
        ] );

        return array_map( function ( WP_Post $post ) {
            return [
                'post_id'     => $post->ID,
                'title'       => $post->post_title ?: '(Untitled)',
                'status'      => $post->post_status,
                'modified'    => $post->post_modified,
                'preview_url' => $this->get_preview_url( $post->ID ),
                'permalink'   => get_permalink( $post->ID ),
            ];
        }, $posts );
    }

    /**
     * Mark a post as AI-generated (for listing).
     */
    public function mark_as_generated( int $post_id ): void {
        update_post_meta( $post_id, '_wpab_generated', '1' );
    }

    /**
     * Update the page title.
     */
    public function update_title( int $post_id, string $title ): void {
        wp_update_post( [
            'ID'         => $post_id,
            'post_title' => sanitize_text_field( $title ),
        ] );
    }
}
