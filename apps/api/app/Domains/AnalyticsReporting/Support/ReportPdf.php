<?php

namespace App\Domains\AnalyticsReporting\Support;

use Barryvdh\DomPDF\Facade\Pdf;
use Dompdf\Dompdf;
use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * Renders every HRneck PDF report (quarterly, target, ticketing, training viewing)
 * so fonts, page size, wordmark and page numbering stay identical across them.
 */
final class ReportPdf
{
    public const FONT_FAMILY = 'Plus Jakarta Sans';

    /** Bundled with dompdf; covers Cyrillic, which Plus Jakarta Sans does not. */
    private const FALLBACK_FAMILY = 'DejaVu Sans';

    /** Locales whose copy needs glyphs that Plus Jakarta Sans does not ship. */
    private const CYRILLIC_LOCALES = ['ru'];

    /** Static instances of the Plus Jakarta Sans variable font, keyed by dompdf weight. */
    private const FONT_FILES = [
        'normal' => 'PlusJakartaSans-Regular.ttf',
        'bold' => 'PlusJakartaSans-Bold.ttf',
    ];

    /** 28px page margin, converted to points (dompdf renders at 96 dpi). */
    private const MARGIN_X_PT = 21.0;

    /** Distance of the page number baseline from the bottom edge of the page. */
    private const PAGE_NUMBER_BASELINE_PT = 24.0;

    /** #64748B */
    private const MUTED_RGB = [0.392, 0.455, 0.545];

    /**
     * @return string Rendered PDF bytes.
     */
    public static function render(string $html): string
    {
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');
        $dompdf = $pdf->getDomPDF();

        self::registerFonts($dompdf);
        $dompdf->render();
        self::stampPageNumbers($dompdf);

        return $dompdf->output();
    }

    /**
     * CSS font-family value for report bodies in the current locale.
     */
    public static function bodyFontStack(): string
    {
        return "'".self::primaryFamily()."', sans-serif";
    }

    /**
     * Wordmark as a data URI, or null when the asset is missing.
     */
    public static function wordmarkDataUri(): ?string
    {
        $file = resource_path('images/hrneck-wordmark.png');

        return is_file($file)
            ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($file))
            : null;
    }

    private static function primaryFamily(): string
    {
        return in_array(app()->getLocale(), self::CYRILLIC_LOCALES, true)
            ? self::FALLBACK_FAMILY
            : self::FONT_FAMILY;
    }

    private static function registerFonts(Dompdf $dompdf): void
    {
        // Use dompdf's own options: storage_path() is tenant-scoped during tenant requests,
        // while dompdf keeps the boot-time font directory.
        $options = $dompdf->getOptions();
        File::ensureDirectoryExists($options->getFontDir());
        File::ensureDirectoryExists($options->getFontCache());

        $fontMetrics = $dompdf->getFontMetrics();

        foreach (self::FONT_FILES as $weight => $file) {
            $registered = $fontMetrics->registerFont(
                ['family' => self::FONT_FAMILY, 'style' => 'normal', 'weight' => $weight],
                resource_path('fonts/'.$file),
            );

            if (! $registered) {
                throw new RuntimeException("Unable to register report font [{$file}].");
            }
        }
    }

    private static function stampPageNumbers(Dompdf $dompdf): void
    {
        $canvas = $dompdf->getCanvas();
        $fontMetrics = $dompdf->getFontMetrics();
        $font = $fontMetrics->getFont(self::primaryFamily());
        $size = 11 * 72 / 96; // 11px, matching the caption size used in the views

        // Right-align against a widest-case label so the number does not drift between pages.
        $widest = __('reports.page_of', ['current' => '999', 'total' => '999']);
        $width = $fontMetrics->getTextWidth($widest, $font, $size);

        $canvas->page_text(
            $canvas->get_width() - self::MARGIN_X_PT - $width,
            $canvas->get_height() - self::PAGE_NUMBER_BASELINE_PT,
            __('reports.page_of', ['current' => '{PAGE_NUM}', 'total' => '{PAGE_COUNT}']),
            $font,
            $size,
            self::MUTED_RGB,
        );
    }
}
