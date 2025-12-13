import type { ProductDetails } from '../types';

export interface Product {
    sr_no?: number | string;
    category?: string;
    sub_category?: string;
    awmdb_id?: string;
    description?: string;
    brand: string;
    model?: string;
    price_inr?: number;
    price?: number;
    [key: string]: any;
}

class ProductService {
    private static instance: ProductService;
    private products: Product[] = [];
    private isLoading: boolean = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() { }

    public static getInstance(): ProductService {
        if (!ProductService.instance) {
            ProductService.instance = new ProductService();
        }
        return ProductService.instance;
    }

    /**
     * Loads product data from the static JSON file.
     * Caches the result in memory.
     */
    public async loadProducts(): Promise<void> {
        if (this.products.length > 0) return;

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.isLoading = true;
        this.loadPromise = fetch('/productDatabase.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load product database');
                }
                return response.json();
            })
            .then(data => {
                this.products = data;
                this.isLoading = false;
                console.log(`Loaded ${this.products.length} products`);
            })
            .catch(err => {
                console.error('Error loading products:', err);
                this.isLoading = false;
                this.loadPromise = null; // Allow retry
                throw err;
            });

        return this.loadPromise;
    }

    public getProducts(): Product[] {
        return this.products;
    }

    public searchProducts(brand?: string, category?: string): Product[] {
        return this.products.filter(p => {
            const brandMatch = !brand || (p.brand && p.brand.toLowerCase() === brand.toLowerCase());
            const categoryMatch = !category || p.category === category;
            return brandMatch && categoryMatch;
        });
    }


    /**
     * Generates a filtered string representation for the LLM context.
     * Optimizes size by limiting items per brand/category to prevent token overflow.
     */
    public getFilteredDatabaseString(allowedCategories: string[], limitPerGroup: number = 20): string {
        const filtered = this.products.filter(p => allowedCategories.includes(p.category || ''));

        // Optimization: Group by category + brand and take top N items
        // This prevents one massive category from dominating the context
        const groups: Record<string, Product[]> = {};


        // Explicitly prioritize Tier 1 brands to ensure they survive truncation
        const TIER_1_BRANDS = ['samsung', 'lg', 'sony', 'crestron', 'extron', 'shure', 'sennheiser', 'qsc', 'biamp', 'yealink', 'poly', 'logitech'];

        filtered.forEach(p => {
            const key = `${p.category}|${p.brand}`;
            if (!groups[key]) groups[key] = [];

            // Allow more items for Tier 1 brands
            const limit = TIER_1_BRANDS.includes(p.brand.toLowerCase()) ? 30 : limitPerGroup;

            if (groups[key].length < limit) {

                groups[key].push(p);
            }
        });

        const optimizedList = Object.values(groups).flat().map(p => ({
            brand: p.brand,
            model: p.model || p.awmdb_id || 'N/A',
            description: p.description,
            category: p.category,
            price: p.price || p.price_inr,
            priceSource: p.price_estimate_required ? 'estimate_required' : 'database',
            currency: p.price_inr ? 'INR' : 'USD'
        }));

        return JSON.stringify(optimizedList);
    }


    /**
     * Returns the FULL database string for Context Caching.
     * No filtering, no limits.
     */
    public getFullDatabaseString(): string {
        const optimizedList = this.products.map(p => ({
            brand: p.brand,
            model: p.model || p.awmdb_id || 'N/A',
            description: p.description,
            category: p.category,
            price: p.price || p.price_inr,
            priceSource: p.price_estimate_required ? 'estimate_required' : 'database',
            currency: p.price_inr ? 'INR' : 'USD'
        }));
        return JSON.stringify(optimizedList);
    }

}

export const productService = ProductService.getInstance();
