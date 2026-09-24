<?php
/**
 * Plugin Name: Custom Marquee Widget
 */

if (!defined('ABSPATH')) exit;

function register_custom_marquee($widgets_manager){

    require_once(__DIR__ . '/widgets/marquee-widget.php');

    $widgets_manager->register(
        new \Custom_Marquee_Widget()
    );

}

add_action(
    'elementor/widgets/register',
    'register_custom_marquee'
);