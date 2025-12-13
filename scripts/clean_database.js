
// ESM-friendly imports
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_FILE = path.join('c:/Users/Adarsh/Desktop/BINGO/BINGO-main/public/productDatabase.json');
const OUTPUT_FILE = path.join('c:/Users/Adarsh/Desktop/BINGO/BINGO-main/public/productDatabase_clean.json');

// Brand Normalization Map (key = messy version, value = clean version)
const BRAND_MAP = {
    'samsung electronics': 'Samsung',
    'samsung display': 'Samsung',
    'samsung inc': 'Samsung',
    'samsung': 'Samsung',
    'lg electronics': 'LG',
    'lg display': 'LG',
    'lg': 'LG',
    'sony professional': 'Sony',
    'sony corporation': 'Sony',
    'sony': 'Sony',
    'crestron electronics': 'Crestron',
    'crestron': 'Crestron',
    'extron electronics': 'Extron',
    'extron': 'Extron',
    'qsc audio': 'QSC',
    'qsc systems': 'QSC',
    'q-sys': 'QSC',
    'qsc': 'QSC',
    'shure inc': 'Shure',
    'shure': 'Shure',
    'sennheiser electronic': 'Sennheiser',
    'sennheiser': 'Sennheiser',
    'biamp systems': 'Biamp',
    'biamp': 'Biamp',
    'kramer electronics': 'Kramer',
    'kramer': 'Kramer',
    'polycom': 'Poly',
    'poly': 'Poly',
    'logitech': 'Logitech',
    'logitech business': 'Logitech',
    'yealink network': 'Yealink',
    'yealink': 'Yealink',
    'cisco systems': 'Cisco',
    'cisco': 'Cisco',
    'barco': 'Barco',
    'barco nv': 'Barco'
};

// Category Normalization Map
const CATEGORY_MAP = {
    'Display': 'Display',
    'Displays': 'Display',
    'Commercial Display': 'Display',
    'Interactive Display': 'Display',
    'Video Wall': 'Display',
    'Audio - Microphones': 'Microphone',
    'Microphones': 'Microphone',
    'Microphone': 'Microphone',
    'Audio - Speakers': 'Speaker',
    'Speakers': 'Speaker',
    'Speaker': 'Speaker',
    'Audio - DSP & Amplification': 'DSP & Amplification',
    'DSP': 'DSP & Amplification',
    'Amplifier': 'DSP & Amplification',
    'Amplifiers': 'DSP & Amplification',
    'Video Conferencing & Cameras': 'Video Conferencing',
    'Video Conferencing': 'Video Conferencing',
    'Conferencing': 'Video Conferencing',
    'Mounts & Racks': 'Mounts & Racks',
    'Mount': 'Mounts & Racks',
    'Rack': 'Mounts & Racks',
    'Control': 'Control',
    'Control System': 'Control',
    'Connectivity': 'Connectivity',
    'Cables': 'Connectivity'
};

try {
    console.log(`Reading from: ${INPUT_FILE}`);
    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    let products = JSON.parse(rawData);
    console.log(`Original count: ${products.length}`);

    let cleanedCount = 0;
    let fixedPrices = 0;

    const validProducts = [];
    const seenIds = new Set(); // For deduplication

    products.forEach(p => {
        // 1. Basic Validation
        if (!p.brand) return; // Skip items without brand

        // 2. Brand Normalization
        const lowerBrand = p.brand.toLowerCase().trim();
        // Check exact matches in map first
        let finalBrand = Object.keys(BRAND_MAP).find(k => k === lowerBrand) ? BRAND_MAP[lowerBrand] : p.brand;

        // If no direct map, capitalize first letter (simple heuristic)
        if (finalBrand === p.brand) {
            finalBrand = p.brand.charAt(0).toUpperCase() + p.brand.slice(1);
        }
        p.brand = finalBrand;

        // 3. Category Normalization
        if (p.category) {
            const mappedCat = Object.keys(CATEGORY_MAP).find(k => p.category.includes(k)); // Simple inclusion check
            if (mappedCat) {
                // p.category = CATEGORY_MAP[mappedCat]; // Optional: Strict mapping. 
                // For now, let's keep original category as 'sub_category' if we change it, or just clean it up?
                // Let's just Map specific messy ones if they match exactly
                if (CATEGORY_MAP[p.category]) p.category = CATEGORY_MAP[p.category];
            }
        }

        // 4. Price Handling
        if (!p.price && !p.price_inr) {
            p.price_estimate_required = true;
            p.price_source = 'estimated';
            fixedPrices++;
        } else {
            p.price_source = 'database';
        }

        // 5. Deduplication (using unique combo of Brand + Model)
        const uniqueKey = `${p.brand}-${p.model || p.awmdb_id || p.itemDescription}`.toLowerCase();
        if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            validProducts.push(p);
        }
    });

    console.log(`Final count after deduplication: ${validProducts.length}`);
    console.log(`Products tagged for price estimation: ${fixedPrices}`);

    // Write output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validProducts, null, 2));
    console.log(`Cleaned database written to: ${OUTPUT_FILE}`);

} catch (e) {
    console.error('Error cleaning database:', e);
}
