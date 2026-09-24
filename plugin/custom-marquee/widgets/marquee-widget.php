<?php

if (!defined('ABSPATH')) exit;

class Custom_Marquee_Widget extends \Elementor\Widget_Base {

    public function get_name() {
        return 'custom_marquee';
    }

    public function get_title() {
        return 'Custom Marquee';
    }

    public function get_icon() {
        return 'eicon-slider-full-screen';
    }

    public function get_categories() {
        return ['general'];
    }

    protected function register_controls() {

        /* =========================================================
         *  SEZIONE CONTENUTO
         * ========================================================= */
        $this->start_controls_section(
            'content_section',
            [
                'label' => 'Contenuto',
            ]
        );

        // Da dove vengono le immagini (1.2.0).
        //
        // 'manuale' e' il default, ed e' quel che fanno tutte le istanze
        // create prima che il controllo esistesse: per loro non cambia niente.
        // Le altre sorgenti le aggiungono altri plugin col filtro
        // custom_marquee/sorgenti, e danno le immagini con
        // custom_marquee/immagini (vedi README). Il marquee non sa cosa siano.
        //
        // Il controllo si registra SEMPRE, anche con una sola opzione: la
        // condizione di 'gallery' lo nomina, e una condizione su un controllo
        // che non esiste nasconde la galleria e ne butta via le immagini.
        $this->add_control(
            'sorgente',
            [
                'label' => 'Sorgente delle immagini',
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => 'manuale',
                'options' => apply_filters('custom_marquee/sorgenti', [
                    'manuale' => 'Immagini scelte a mano'
                ])
            ]
        );

        // Immagini da Media Library
        $this->add_control(
            'gallery',
            [
                'label' => 'Immagini',
                'type' => \Elementor\Controls_Manager::GALLERY,
                'condition' => [
                    'sorgente' => 'manuale'
                ]
            ]
        );

        // ---- Sorgenti esterne: quante e quanto grandi -----------------
        $this->add_control(
            'max_immagini',
            [
                'label' => 'Immagini al massimo',
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 20,
                'min' => 1,
                'max' => 100,
                'condition' => [
                    'sorgente!' => 'manuale'
                ]
            ]
        );

        // Non l'originale: una sorgente esterna puo' dare file enormi (un
        // disegno della Lavagna arriva a 2 MB), e il marquee carica tutto
        // subito e a priorita' alta.
        $misure = [];
        foreach (wp_get_registered_image_subsizes() as $nome => $m) {
            $misure[$nome] = $nome . ' (' . $m['width'] . ' x ' . $m['height'] . ')';
        }
        $misure['full'] = 'Originale';
        $this->add_control(
            'misura',
            [
                'label' => 'Misura del file',
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => 'large',
                'options' => $misure,
                'description' => 'Il file che il browser scarica. Per restare nitido sugli schermi ad alta densità deve essere circa il doppio della dimensione a schermo.',
                'condition' => [
                    'sorgente!' => 'manuale'
                ]
            ]
        );

        // ---- Modalità dimensionamento immagini -------------------
        $this->add_control(
            'image_mode',
            [
                'label' => 'Dimensionamento immagini',
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => 'crop',
                'options' => [
                    'crop'  => 'Dimensione fissa (ritaglio)',
                    'ratio' => 'Proporzioni originali'
                ],
                'description' => 'In "Proporzioni originali" ogni immagine mantiene il proprio rapporto; il lato più lungo non supera la dimensione massima. Le immagini più piccole non vengono ingrandite.'
            ]
        );

        // ---- MODALITÀ CROP: larghezza + altezza fisse -------------
        $this->add_responsive_control(
            'width',
            [
                'label' => 'Larghezza',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 50,
                        'max' => 1200
                    ]
                ],
                'default' => [
                    'size' => 300,
                    'unit' => 'px'
                ],
                'selectors' => [
                    '{{WRAPPER}} .mq-img' =>
                        'width: {{SIZE}}{{UNIT}};'
                ],
                'condition' => [
                    'image_mode' => 'crop'
                ]
            ]
        );

        $this->add_responsive_control(
            'height',
            [
                'label' => 'Altezza',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 50,
                        'max' => 1200
                    ]
                ],
                'default' => [
                    'size' => 270,
                    'unit' => 'px'
                ],
                'selectors' => [
                    '{{WRAPPER}} .mq-img' =>
                        'height: {{SIZE}}{{UNIT}};'
                ],
                'condition' => [
                    'image_mode' => 'crop'
                ]
            ]
        );

        // ---- MODALITÀ RATIO: dimensione massima lato lungo --------
        $this->add_responsive_control(
            'max_size',
            [
                'label' => 'Dimensione massima (lato lungo)',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 50,
                        'max' => 1200
                    ]
                ],
                'default' => [
                    'size' => 400,
                    'unit' => 'px'
                ],
                'selectors' => [
                    // max-* non ingrandisce mai: le immagini più piccole
                    // restano alla dimensione naturale.
                    '{{WRAPPER}} .mq-img' =>
                        'max-width: {{SIZE}}{{UNIT}}; max-height: {{SIZE}}{{UNIT}};'
                ],
                'condition' => [
                    'image_mode' => 'ratio'
                ]
            ]
        );

        // Gap (distanza fissa tra un elemento e l'altro)
        //
        // Il padding-right uguale al gap non e' decorativo: chiude il giro.
        // Fra un'immagine e l'altra c'e' un gap, ma in fondo alla seconda
        // copia no: la striscia misurava 2 copie + (2n - 1) gap, e il -50%
        // del keyframe cadeva mezzo gap PRIMA dell'inizio della seconda
        // copia. A ogni giro l'immagine scattava in avanti di gap/2:
        // misurato 11,9px su /chi-siamo/ con gap 24 (1.0.0). Con il padding
        // la striscia e' 2 x (copia + n gap), e -50% cade esattamente li'.
        $this->add_responsive_control(
            'gap',
            [
                'label' => 'Gap',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'default' => [
                    'size' => 24,
                    'unit' => 'px'
                ],
                'selectors' => [
                    '{{WRAPPER}} .marquee-inner' =>
                        'gap: {{SIZE}}{{UNIT}}; padding-right: {{SIZE}}{{UNIT}};'
                ]
            ]
        );

        // Margine immagini
        $this->add_responsive_control(
            'margin',
            [
                'label' => 'Margine immagini',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'default' => [
                    'size' => 50,
                    'unit' => 'px'
                ],
                'selectors' => [
                    '{{WRAPPER}} .mq-img' =>
                        'margin: {{SIZE}}{{UNIT}};'
                ]
            ]
        );

        // Velocità (durata scoped per-istanza)
        $this->add_control(
            'speed',
            [
                'label' => 'Velocità (secondi)',
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 75,
                'selectors' => [
                    '{{WRAPPER}} .marquee-inner' =>
                        'animation-duration: {{VALUE}}s;'
                ],
                'condition' => [
                    'sorgente' => 'manuale'
                ]
            ]
        );

        // Con una sorgente esterna il numero di immagini cambia da solo, e a
        // durata fissa la striscia accelererebbe a ogni immagine in piu'. Qui
        // la durata si calcola: vedi includes/giro.php.
        $this->add_control(
            'velocita_px',
            [
                'label' => 'Velocità (pixel al secondo)',
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 60,
                'min' => 1,
                'description' => 'Resta la stessa qualunque sia il numero di immagini. Vale per il desktop: dove le immagini sono più piccole, scorre in proporzione.',
                'condition' => [
                    'sorgente!' => 'manuale'
                ]
            ]
        );

        // Pausa al passaggio del mouse / touch
        $this->add_control(
            'pause_on_hover',
            [
                'label' => 'Pausa al passaggio / touch',
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => 'Sì',
                'label_off' => 'No',
                'return_value' => 'yes',
                'default' => 'yes',
                'description' => 'Ferma lo scorrimento con il mouse sopra (desktop) o tenendo il dito premuto (mobile).'
            ]
        );

        $this->end_controls_section();


        /* =========================================================
         *  SEZIONE DIDASCALIA
         * ========================================================= */
        $this->start_controls_section(
            'caption_section',
            [
                'label' => 'Didascalia',
            ]
        );

        $this->add_control(
            'show_caption',
            [
                'label' => 'Mostra didascalia',
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => 'Sì',
                'label_off' => 'No',
                'return_value' => 'yes',
                'default' => 'yes',
                'description' => 'Mostra la didascalia (caption) impostata nella Media Library, se presente.'
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'caption_typography',
                'selector' => '{{WRAPPER}} .mq-caption',
                'condition' => [
                    'show_caption' => 'yes'
                ]
            ]
        );

        $this->add_control(
            'caption_color',
            [
                'label' => 'Colore',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#000000',
                'selectors' => [
                    '{{WRAPPER}} .mq-caption' =>
                        'color: {{VALUE}};'
                ],
                'condition' => [
                    'show_caption' => 'yes'
                ]
            ]
        );

        $this->add_responsive_control(
            'caption_offset_v',
            [
                'label' => 'Offset verticale',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => -100,
                        'max' => 200
                    ]
                ],
                'default' => [
                    'size' => 8,
                    'unit' => 'px'
                ],
                'selectors' => [
                    '{{WRAPPER}} .mq-caption' =>
                        'margin-top: {{SIZE}}{{UNIT}};'
                ],
                'condition' => [
                    'show_caption' => 'yes'
                ]
            ]
        );

        $this->add_responsive_control(
            'caption_offset_h',
            [
                'label' => 'Offset orizzontale',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => -200,
                        'max' => 200
                    ]
                ],
                'default' => [
                    'size' => 0,
                    'unit' => 'px'
                ],
                'selectors' => [
                    '{{WRAPPER}} .mq-caption' =>
                        'transform: translateX({{SIZE}}{{UNIT}});'
                ],
                'condition' => [
                    'show_caption' => 'yes'
                ]
            ]
        );

        $this->end_controls_section();

    }

    /**
     * Le immagini di una sorgente esterna, gia' ripetute per riempire il giro,
     * e lo stile con la durata che tiene costante la velocita'.
     *
     * La sorgente da' solo gli id degli allegati (filtro
     * custom_marquee/immagini): misura del file, ripetizioni e durata le
     * decide il marquee, perche' dipendono da come la striscia e' disegnata.
     *
     * @return array [elenco per render_item, attributo style per .marquee-inner]
     */
    private function giro_esterno($sorgente, $settings) {

        $max = isset($settings['max_immagini']) ? max(1, (int) $settings['max_immagini']) : 20;
        $ids = apply_filters('custom_marquee/immagini', [], $sorgente, $max);

        $misura = !empty($settings['misura']) ? $settings['misura'] : 'large';
        $px = function ($chiave, $riserva) use ($settings) {
            return isset($settings[$chiave]['size']) && $settings[$chiave]['size'] !== ''
                ? (float) $settings[$chiave]['size']
                : $riserva;
        };
        $modo = isset($settings['image_mode']) ? $settings['image_mode'] : 'crop';

        $copia = [];
        $larghezza = 0.0;
        foreach (array_slice((array) $ids, 0, $max) as $id) {
            $src = wp_get_attachment_image_src((int) $id, $misura);
            if (!is_array($src) || empty($src[1]) || empty($src[2])) {
                continue;
            }
            $copia[] = ['id' => (int) $id, 'url' => $src[0], 'w' => (int) $src[1], 'h' => (int) $src[2]];
            $larghezza += custom_marquee_larghezza_elemento(
                $src[1], $src[2], $modo,
                $px('max_size', 400), $px('width', 300), $px('margin', 50), $px('gap', 24)
            );
        }
        if (!$copia) {
            return [[], ''];
        }

        $volte = custom_marquee_ripetizioni($larghezza);
        $immagini = [];
        for ($i = 0; $i < $volte; $i++) {
            $immagini = array_merge($immagini, $copia);
        }

        $v = isset($settings['velocita_px']) ? (float) $settings['velocita_px'] : 60;
        $durata = custom_marquee_durata($volte * $larghezza, $v);

        // Nell'attributo style, non nel CSS di Elementor: dipende da quante
        // immagini ci sono adesso, e il CSS della pagina e' scritto una volta.
        return [$immagini, ' style="animation-duration:' . sprintf('%.2F', $durata) . 's"'];

    }

    /**
     * Renderizza un singolo item (immagine + eventuale didascalia).
     * Usato sia per le immagini originali sia per i cloni del loop.
     *
     * Gli attributi width/height nativi vengono emessi sempre: servono al
     * browser per conoscere il rapporto d'aspetto e riservare lo spazio
     * corretto PRIMA che l'immagine sia scaricata. Senza di essi, in
     * modalità "proporzioni originali" la larghezza totale della riga
     * cambierebbe durante il caricamento e il translateX(-50%) del loop
     * risulterebbe momentaneamente sbagliato (scatto visibile).
     */
    private function render_item($image, $show_caption) {

        $url = esc_url($image['url']);

        $dim_attr = '';
        $caption  = '';

        if (!empty($image['id'])) {

            // Le sorgenti esterne portano gia' le misure del file che si
            // serve (non l'originale); le immagini scelte a mano no.
            $src = isset($image['w'])
                ? [$image['url'], $image['w'], $image['h']]
                : wp_get_attachment_image_src($image['id'], 'full');

            if (is_array($src) && !empty($src[1]) && !empty($src[2])) {
                $dim_attr = ' width="' . esc_attr($src[1]) . '"'
                          . ' height="' . esc_attr($src[2]) . '"';
            }

            if ($show_caption === 'yes') {
                // Campo "Didascalia" (caption) della Media Library
                $caption = wp_get_attachment_caption($image['id']);
            }

        }

        echo '<div class="mq-item">';

            echo '<img
            src="' . $url . '"' . $dim_attr . '
            class="mq-img drop-shadow random-tilt"
            loading="eager"
            fetchpriority="high"
            decoding="sync"
            alt="">';

            if (!empty($caption)) {
                echo '<span class="mq-caption">' . esc_html($caption) . '</span>';
            }

        echo '</div>';

    }

    protected function render() {

        $settings = $this->get_settings_for_display();

        $sorgente = isset($settings['sorgente']) ? $settings['sorgente'] : 'manuale';

        if ($sorgente === 'manuale') {

            if (empty($settings['gallery'])) {
                return;
            }
            $immagini = $settings['gallery'];
            $stile_inner = '';

        } else {

            list($immagini, $stile_inner) = $this->giro_esterno($sorgente, $settings);

            if (empty($immagini)) {
                // Sul sito non si stampa niente; nell'editor un widget vuoto
                // non si vede e non si riesce a selezionare.
                if (\Elementor\Plugin::$instance->editor->is_edit_mode()) {
                    echo '<p style="text-align:center;opacity:.6">Custom Marquee: la sorgente non ha ancora immagini.</p>';
                }
                return;
            }

        }

        $show_caption = isset($settings['show_caption']) ? $settings['show_caption'] : '';
        $image_mode   = isset($settings['image_mode']) ? $settings['image_mode'] : 'crop';
        $pause        = isset($settings['pause_on_hover']) ? $settings['pause_on_hover'] : '';

        $uid = 'mq-' . esc_attr($this->get_id());

        $track_classes = 'marquee-track';
        $track_classes .= ($image_mode === 'ratio') ? ' mq-mode-ratio' : ' mq-mode-crop';
        if ($pause === 'yes') {
            $track_classes .= ' mq-pause-on-hover';
        }

        ?>

        <div class="<?= $track_classes ?>" id="<?= $uid ?>">

            <div class="marquee-inner"<?= $stile_inner ?>>

                <?php

                // immagini originali
                foreach ($immagini as $image) {
                    $this->render_item($image, $show_caption);
                }

                // clone automatico (necessario al loop infinito)
                foreach ($immagini as $image) {
                    $this->render_item($image, $show_caption);
                }

                ?>

            </div>

        </div>

<style>

.marquee-track{

    overflow:hidden;
    width:100%;

}

.marquee-inner{

    display:flex;

    /* immagini di altezza diversa centrate verticalmente */
    align-items:center;

    width:max-content;

    /* durata di fallback; il controllo "Velocità" la sovrascrive
       per-istanza via animation-duration scoped su {{WRAPPER}} */
    animation:
    marquee 75s
    linear infinite;

}

/* contenitore immagine + didascalia (colonna) */
.mq-item{

    display:flex;

    flex-direction:column;

    align-items:center;

    flex-shrink:0;

}

.mq-img{

    display:block;

    flex-shrink:0;

    transform:translateZ(0);

    backface-visibility:hidden;

    will-change:transform;

}

/* --- MODALITÀ DIMENSIONE FISSA (ritaglio) --- */
.mq-mode-crop .mq-img{

    object-fit:cover;

}

/* --- MODALITÀ PROPORZIONI ORIGINALI ---
   width/height auto + max-width/max-height (dal controllo
   "Dimensione massima") = rapporto d'aspetto preservato,
   lato lungo limitato, nessun ingrandimento. */
.mq-mode-ratio .mq-img{

    width:auto;

    height:auto;

    object-fit:contain;

}

/* didascalia: elemento separato, quindi SENZA tilt e SENZA drop-shadow. */
.mq-caption{

    display:block;

    text-align:center;

    flex-shrink:0;

}

/* --- PAUSA ---
   L'hover è confinato ai dispositivi con puntatore reale: su touch
   l'hover "si incolla" dopo il tap e lascerebbe il marquee fermo. */
@media (hover: hover) and (pointer: fine){

    .mq-pause-on-hover:hover .marquee-inner{

        animation-play-state:paused;

    }

}

/* stato applicato via JS per il touch */
.marquee-inner.is-paused{

    animation-play-state:paused;

}

@keyframes marquee{

    from{

        transform:translateX(0);

    }

    to{

        transform:translateX(-50%);

    }

}

</style>

<?php if ($pause === 'yes') : ?>
<script>
(function(){

    var track = document.getElementById('<?= $uid ?>');

    if(!track || track.dataset.mqBound) return;
    track.dataset.mqBound = '1';

    var inner = track.querySelector('.marquee-inner');
    if(!inner) return;

    var pause  = function(){ inner.classList.add('is-paused'); };
    var resume = function(){ inner.classList.remove('is-paused'); };

    track.addEventListener('touchstart',  pause,  {passive:true});
    track.addEventListener('touchend',    resume, {passive:true});
    track.addEventListener('touchcancel', resume, {passive:true});

})();
</script>
<?php endif; ?>

<?php

    }

}