<?php
/**
 * Plugin Name:      Custom Marquee Widget
 * Description:      Widget Elementor: una striscia di immagini che scorre senza fine.
 * Version:          1.0.0
 * Author:           Issimissimo
 * Requires Plugins: elementor
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