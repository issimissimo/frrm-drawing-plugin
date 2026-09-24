<?php
/**
 * Plugin Name:      Custom Marquee Widget
 * Description:      Widget Elementor: una striscia di immagini che scorre senza fine.
 * Version:          1.2.0
 * Author:           Issimissimo
 * Requires Plugins: elementor
 */

if (!defined('ABSPATH')) exit;

// Va cambiata insieme a Version: qui sopra. pacchetto.py rifiuta di
// costruire lo zip se divergono.
const CUSTOM_MARQUEE_VER = '1.2.0';

require_once __DIR__ . '/includes/giro.php';

/**
 * Al primo caricamento di una versione nuova, Elementor rifa' il CSS.
 *
 * I controlli con 'selectors' non finiscono nell'HTML ma nel CSS che
 * Elementor scrive per ogni pagina (uploads/elementor/css/post-N.css) e poi
 * non rilegge piu'. Se una versione nuova cambia un selettore, come la 1.1.0
 * con il padding del gap, senza questo le pagine gia' generate tengono il CSS
 * vecchio: la correzione e' installata e non si vede.
 *
 * Costa una rigenerazione pigra del CSS di tutte le pagine, una volta per
 * versione. Il confronto a ogni richiesta e' una get_option gia' in memoria.
 */
add_action('init', function () {
    if (get_option('custom_marquee_ver') === CUSTOM_MARQUEE_VER || !did_action('elementor/loaded')) {
        return;
    }
    \Elementor\Plugin::$instance->files_manager->clear_cache();
    update_option('custom_marquee_ver', CUSTOM_MARQUEE_VER);
});

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