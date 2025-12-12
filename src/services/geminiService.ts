import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Boq, BoqItem, ProductDetails, Room, ValidationResult, GroundingSource } from '../types';
import { productDatabase } from '../data/productData';
import { logActivity } from './activityLogService';
import { getCurrentUser } from 'aws-amplify/auth';

// process.env.API_KEY is shimmed by vite.config.ts using define.
const ai = new GoogleGenerativeAI(process.env.API_KEY || '');

// Pre-calculate database statistics
// Helper to generate filtered database string
const getFilteredDatabaseString = (allowedCategories: string[]): string => {
  const filteredProducts = productDatabase.filter(p => allowedCategories.includes(p.category || ''));
  return JSON.stringify(filteredProducts.map(p => ({
    brand: p.brand,
    model: p.model || p.awmdb_id || 'N/A',
    description: p.description,
    category: p.category,
    price: p.price || p.price_inr,
    currency: p.price_inr ? 'INR' : 'USD'
  })));
}

/**
 * Helper function to clean JSON output from AI response
 */
const cleanJsonOutput = (text: string): string => {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
};

/**
 * Helper function to search database for products matching criteria
 */
const searchDatabase = (brand?: string, category?: string): any[] => {
  return productDatabase.filter(p => {
    const brandMatch = !brand || p.brand.toLowerCase() === brand.toLowerCase();
    const categoryMatch = !category || p.category === category;
    return brandMatch && categoryMatch;
  });
};

/**
 * Helper function to get available brands for a category from database
 */
const getAvailableBrands = (category: string): string[] => {
  const brands = productDatabase
    .filter(p => p.category === category)
    .map(p => p.brand);
  return [...new Set(brands)]; // Remove duplicates
};

/**
 * Generates a Bill of Quantities (BOQ) based on user requirements.
 */
export const generateBoq = async (answers: Record<string, any>): Promise<Boq> => {
  const model = 'gemini-2.0-flash';

  // Cast the incoming answers property to a string array to satisfy TypeScript
  // Use double casting (unknown -> string[]) to avoid "Type 'unknown[]' is not assignable to type 'string[]'" errors
  const requiredSystems = (answers.requiredSystems as unknown as string[]) || ['display', 'video_conferencing', 'audio', 'connectivity_control', 'infrastructure', 'acoustics'];

  // UPDATED CATEGORY MAPPING FOR ACTUAL DATA VALUES
  const categoryMap: Record<string, string[]> = {
    display: ["Display System", "Hiperwall System"],
    video_conferencing: ["VC system", "VC System"],
    audio: ["Audio System"],
    connectivity_control: ["Cables & Connectors", "Cables and Connectors", "Control System", "Room Scheduler"],
    infrastructure: ["Display support system", "Display Support System", "Display Supoort System", "Display support System", "AV Rack System", "AV Rack system"],
    acoustics: ["Acoustic Treatment"], // None found in DB scan but keeping for safety
  };

  const allowedCategories = requiredSystems.flatMap((system: string) => categoryMap[system] || []);
  allowedCategories.push("Accessories & Services"); // Always include general accessories
  allowedCategories.push("Installation & Services"); // Always include services

  // Generate dynamic database string based on allowed categories
  const curatedDatabaseString = getFilteredDatabaseString(allowedCategories);

  // Extract brand preferences with granular audio control
  const brandPreferences = {
    displays: Array.isArray(answers.displayBrands) ? answers.displayBrands.join(', ') : '',
    mounts: Array.isArray(answers.mountBrands) ? answers.mountBrands.join(', ') : '',
    racks: Array.isArray(answers.rackBrands) ? answers.rackBrands.join(', ') : '',
    // Granular audio brand preferences (new approach)
    microphones: Array.isArray(answers.microphoneBrands) ? answers.microphoneBrands.join(', ') :
      (Array.isArray(answers.audioBrands) ? answers.audioBrands.join(', ') : ''), // Fallback to old audioBrands if new field doesn't exist
    dspAmplifiers: Array.isArray(answers.dspAmplifierBrands) ? answers.dspAmplifierBrands.join(', ') :
      (Array.isArray(answers.audioBrands) ? answers.audioBrands.join(', ') : ''),
    speakers: Array.isArray(answers.speakerBrands) ? answers.speakerBrands.join(', ') :
      (Array.isArray(answers.audioBrands) ? answers.audioBrands.join(', ') : ''),
    vc: Array.isArray(answers.vcBrands) ? answers.vcBrands.join(', ') : '',
    connectivity: Array.isArray(answers.connectivityBrands) ? answers.connectivityBrands.join(', ') : '',
    control: Array.isArray(answers.controlBrands) ? answers.controlBrands.join(', ') : '',
  };

  // Calculate room metrics
  const roomLength = parseFloat(answers.roomLength) || 20;
  const roomWidth = parseFloat(answers.roomWidth) || 15;
  const roomHeight = parseFloat(answers.roomHeight) || 10;
  const tableLength = parseFloat(answers.tableLength) || 12;
  const rackDistance = parseFloat(answers.rackDistance) || 30;
  const capacity = parseInt(answers.capacity) || 10;
  const roomVolume = roomLength * roomWidth * roomHeight;
  const roomArea = roomLength * roomWidth;

  // Generate database availability report
  const dbAvailabilityReport: string[] = [];

  if (brandPreferences.displays) {
    const brands = brandPreferences.displays.split(',').map((b: string) => b.trim());
    brands.forEach((brand: string) => {
      const available = searchDatabase(brand, 'Display'); // Check primary category
      if (available.length > 0) {
        dbAvailabilityReport.push(`✅ Database has ${available.length} ${brand} Display(s) - USE THESE FIRST`);
      } else {
        dbAvailabilityReport.push(`⚠️ Database has NO ${brand} Displays - Generate from web knowledge`);
      }
    });
  }

  // Granular audio brand checking
  if (brandPreferences.microphones) {
    const brands = brandPreferences.microphones.split(',').map((b: string) => b.trim());
    brands.forEach((brand: string) => {
      const mics = searchDatabase(brand, 'Audio - Microphones');
      if (mics.length > 0) {
        dbAvailabilityReport.push(`✅ Database has ${mics.length} ${brand} Microphone(s) - USE THESE FIRST`);
      } else {
        dbAvailabilityReport.push(`⚠️ Database has NO ${brand} Microphones - Generate from web knowledge`);
      }
    });
  }

  if (brandPreferences.dspAmplifiers) {
    const brands = brandPreferences.dspAmplifiers.split(',').map((b: string) => b.trim());
    brands.forEach((brand: string) => {
      const dsp = searchDatabase(brand, 'Audio - DSP & Amplification');
      if (dsp.length > 0) {
        dbAvailabilityReport.push(`✅ Database has ${dsp.length} ${brand} DSP/Amplifier(s) - USE THESE FIRST`);
      } else {
        dbAvailabilityReport.push(`⚠️ Database has NO ${brand} DSP/Amplifiers - Generate from web knowledge`);
      }
    });
  }

  if (brandPreferences.speakers) {
    const brands = brandPreferences.speakers.split(',').map((b: string) => b.trim());
    brands.forEach((brand: string) => {
      const speakers = searchDatabase(brand, 'Audio - Speakers');
      if (speakers.length > 0) {
        dbAvailabilityReport.push(`✅ Database has ${speakers.length} ${brand} Speaker(s) - USE THESE FIRST`);
      } else {
        dbAvailabilityReport.push(`⚠️ Database has NO ${brand} Speakers - Generate from web knowledge`);
      }
    });
  }

  if (brandPreferences.vc) {
    const brands = brandPreferences.vc.split(',').map((b: string) => b.trim());
    brands.forEach((brand: string) => {
      const available = searchDatabase(brand, 'Video Conferencing & Cameras');
      if (available.length > 0) {
        dbAvailabilityReport.push(`✅ Database has ${available.length} ${brand} VC product(s) - USE THESE FIRST`);
      } else {
        dbAvailabilityReport.push(`⚠️ Database has NO ${brand} VC products - Generate from web knowledge`);
      }
    });
  }

  if (brandPreferences.mounts) {
    const brands = brandPreferences.mounts.split(',').map((b: string) => b.trim());
    brands.forEach((brand: string) => {
      const available = searchDatabase(brand, 'Mounts & Racks');
      if (available.length > 0) {
        dbAvailabilityReport.push(`✅ Database has ${available.length} ${brand} Mount(s) - USE THESE FIRST`);
      } else {
        dbAvailabilityReport.push(`⚠️ Database has NO ${brand} Mounts - Generate from web knowledge`);
      }
    });
  }

  const dbReport = dbAvailabilityReport.length > 0
    ? `\n\n**DATABASE AVAILABILITY REPORT:**\n${dbAvailabilityReport.join('\n')}\n`
    : '';

  const requirements = Object.entries(answers)
    .map(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        return `${key}: ${value.join(', ')}`;
      }
      if (value) {
        return `${key}: ${value}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('; ');

  const prompt = `You are a world-class, Senior AV Solutions Architect (CTS-D Certified) with 25 years of experience. Your goal is to generate a **100% production-ready, fully AVIXA-compliant Bill of Quantities (BOQ)** that can be deployed immediately without modifications.

**CUSTOM PRODUCT DATABASE (PRIORITY SOURCE #1):**
Your company maintains a curated database of verified AV products.
**YOU MUST CHECK THIS DATABASE FIRST FOR EVERY COMPONENT.**
${dbReport}

**CLIENT CONFIGURATION:** 
${requirements}

**CALCULATED ROOM METRICS:**
- Room Dimensions: ${roomLength}ft × ${roomWidth}ft × ${roomHeight}ft (${roomArea} sq ft, ${roomVolume} cu ft)
- Table Length: ${tableLength}ft
- Capacity: ${capacity} people
- Rack Distance from Display/Table: ${rackDistance}ft
- Total Cable Run Estimate: ${(roomLength + roomWidth + rackDistance) * 1.4}ft (including service loops & vertical runs)

**MANDATORY BRAND COMPLIANCE (ZERO TOLERANCE):**
You must strictly adhere to the following brand constraints. Each category has specific brand requirements:

**DISPLAY SYSTEMS:**
*   **Displays:** ${brandPreferences.displays || 'Use Tier 1 defaults: Samsung, LG, Sony'}
*   **Mounts:** ${brandPreferences.mounts || 'Use Tier 1 defaults: Chief, Peerless-AV, B-Tech'}

**AUDIO SYSTEMS (GRANULAR CONTROL):**
*   **Microphones ONLY:** ${brandPreferences.microphones || 'Use Tier 1 defaults: Shure, Sennheiser, Audio-Technica'}
*   **DSP & Amplifiers ONLY:** ${brandPreferences.dspAmplifiers || 'Use Tier 1 defaults: QSC, Biamp, BSS'}
*   **Speakers ONLY:** ${brandPreferences.speakers || 'Use Tier 1 defaults: QSC, JBL, Biamp'}

**OTHER SYSTEMS:**
*   **Video Conferencing:** ${brandPreferences.vc || 'Use Tier 1 defaults: Yealink, Poly, Logitech'}
*   **Connectivity:** ${brandPreferences.connectivity || 'Use Tier 1 defaults: Crestron, Extron, Kramer'}
*   **Control:** ${brandPreferences.control || 'Use Tier 1 defaults: Crestron, Extron, QSC'}
*   **Racks:** ${brandPreferences.racks || 'Use Tier 1 defaults: Valrack, Middle Atlantic, Netrack'}

**CRITICAL RULES:**

1.  **BRAND LOCK (HIGHEST PRIORITY):**
    *   If the user specified a brand (e.g., "JBL" for Audio), you **MUST ONLY** generate items from that brand for that entire category.
    *   **Scenario:** User wants "JBL" Audio. Database has JBL Speakers but NO JBL Microphones.
    *   **Action:** You MUST generate a valid JBL Microphone model using your internal knowledge (Source: 'web', PriceSource: 'estimated').
    *   **FORBIDDEN:** Do NOT switch brands. Brand preference trumps Database availability.
    *   If multiple brands selected, choose the best technical fit from those specific brands.

2.  **DATABASE vs. WEB PRIORITY (STRICT ENFORCEMENT):**
    
    **STEP 1 - ALWAYS CHECK DATABASE FIRST:**
    - For EVERY component you need to add, search the Custom Product Database JSON first
    - Look for exact brand match in the relevant category
    - **Example:** Need Samsung Display? Search database for: brand="Samsung" AND category="Display"
    
    **STEP 2 - IF FOUND IN DATABASE:**
    - ✅ **USE IT IMMEDIATELY** - Set source='database'
    - If price exists: Use database price, set priceSource='database'
    - If price is 0 or null: Keep item, estimate realistic price, set priceSource='estimated'
    - **NEVER skip a database item** just because it lacks a price
    
    **STEP 3 - IF NOT FOUND IN DATABASE:**
    - ⚠️ Only then generate from your web knowledge
    - Set source='web', priceSource='estimated'
    - Add note in keyRemarks: "Item sourced from web knowledge - verify current availability"
    
    **STEP 4 - BRAND LOCK OVERRIDE:**
    - If user requests "JBL Audio" but database has NO JBL products at all
    - You MUST still generate JBL products from web knowledge (don't switch to Shure)
    - Brand preference ALWAYS trumps database availability
    
    **DATABASE SEARCH PRIORITY ORDER:**
    1. Exact brand + category match in database → USE IT (source='database')
    2. No database match but brand requested → Generate from web (source='web')
    3. No brand preference given → Use professional Tier 1 defaults from database if available
    
    **TRACKING:**
    - Every item MUST have 'source' field: 'database' or 'web'
    - Every item MUST have 'priceSource' field: 'database' or 'estimated'
    - In keyRemarks, mention if item is from database: "Selected from company database for verified compatibility"

3.  **AVIXA SIGNAL FLOW COMPLIANCE (CTS-D STANDARD):**
    
    **A. DISPLAY SIGNAL CHAIN:**
    - Source Device → Video Cable → Switcher/Extender → Video Cable → Display
    - **Distance Rules (MANDATORY):**
      * 0-25ft: Standard HDMI cable (High Speed, CL3 rated if in-wall)
      * 25-50ft: Active HDMI cable OR Certified Premium HDMI
      * 50-150ft: **MUST include HDBaseT extender pair (TX + RX)** + CAT6A cable (CMP rated if plenum: ${answers.plenumRequirement === 'plenum_required'})
      * 150ft+: Fiber optic HDMI extender required
    - Calculate total run: rackDistance (${rackDistance}ft) + tableLength (${tableLength}ft) + vertical drops (estimate 15ft)
    - **Total estimated run: ${rackDistance + tableLength + 15}ft** - Select appropriate solution.
    - If 4K@60Hz 4:4:4, use HDMI 2.0 minimum or DisplayPort 1.4
    - If interactive display, include USB extension (active cable if >15ft, USB-over-Cat if >50ft)

    **B. AUDIO SIGNAL CHAIN (CONFERENCING):**
    - Microphone → DSP/Mixer → Amplifier → Speakers
    - **MANDATORY Requirements:**
      * If ceiling mics used: MUST include Dante or AES67 compatible DSP
      * If conferencing enabled: MUST include DSP with Acoustic Echo Cancellation (AEC)
      * If room has both mics AND speakers: AEC is NON-NEGOTIABLE
    - **Microphone Quantity Calculation:**
      * Ceiling mics: Coverage radius ~15ft each. Required: Math.ceil(${roomArea} / 700) = ${Math.ceil(roomArea / 700)} mics minimum
      * Table mics: 1 per 4 people. Required: Math.ceil(${capacity} / 4) = ${Math.ceil(capacity / 4)} mics
    - **Speaker Quantity Calculation:**
      * Ceiling speakers: 1 per 150-200 sq ft. Required: Math.ceil(${roomArea} / 175) = ${Math.ceil(roomArea / 175)} speakers
      * Target: 70dB SPL at furthest seat for conference, 85dB for auditorium
    - **Speaker Wire Gauge:** For 100ft run @ 8Ω @ 100W: Use 14AWG minimum (adjust for actual power/distance)
    - **Amplifier Sizing:** Total speaker wattage × 1.5 (headroom) = required amp power. Round to standard channel config (2, 4, 8, 16 ch).

    **C. VIDEO CONFERENCING CHAIN:**
    - Camera → Codec/Compute → Network + Display Output
    - **Camera Requirements (AVIXA VIP Standard):**
      * Horizontal FOV should cover table width × 1.2 = ${tableLength * 1.2}ft
      * Camera placement: 3-5ft above display center
      * For rooms >${roomLength > 25 ? 'YES' : 'NO'} 25ft deep: PTZ camera with minimum 12x optical zoom required
    - **Network Requirements:**
      * PoE+ for static cameras (25W), PoE++ for PTZ (60W)
      * Managed network switch with IGMP snooping if Dante or AV-over-IP used
      * Dedicated VLAN recommended for AV traffic

    **D. CONTROL SIGNAL CHAIN:**
    - Control Processor → RS-232/Ethernet/IR → Controlled Devices
    - Touch Panel/Keypad → Control Processor (TCP/IP)
    - If >3 devices controlled: MUST include dedicated control processor (Crestron, Extron, QSC)
    - Include control of: Displays, Switchers, DSP, Cameras, Lighting (if ${answers.lightingControl !== 'no'}), Shades (if ${answers.shadeControl === 'yes'})

    **E. POWER DISTRIBUTION (NEC Article 640 Compliance):**
    - Calculate total power draw: Sum all device wattages × 1.3 (inrush safety factor)
    - If total >1800W: MUST include dedicated 20A circuit (note in Accessories & Services)
    - Rack PDU should be sequenced (Furman, Middle Atlantic, APC) to avoid inrush
    - Include surge protection (minimum 1000 Joules)
    - UPS requirement: ${answers.upsRequirement !== 'none' ? 'REQUIRED - Include UPS with ' + (answers.upsRequirement === 'ups_for_rack_and_displays' ? 'sufficient VA for rack + displays' : 'sufficient VA for rack equipment') : 'Not required'}

    **F. NETWORK INFRASTRUCTURE:**
    - Calculate required drops: VC Codec (1) + Control Panel (1) + Network Switch (1) + Wireless Presentation (1) + Any IP cameras + 2 spares
    - If AV-over-IP: Managed switch (24-port minimum), CAT6A cabling, fiber backbone if >100m
    - Calculate bandwidth: 4K stream ~10Gbps, 1080p ~3Gbps
    - All network drops: CAT6A minimum (supports 10GbE)

4.  **AVIXA STANDARDS VERIFICATION:**
    
    **A. DISPLAY VIEWING DISTANCE (AVIXA DMD):**
    - 4K Display: Max viewing distance = Screen Height × 1.5
    - 1080p Display: Max viewing distance = Screen Height × 2.5
    - Room depth: ${roomLength}ft
    - **Calculate:** If ${roomLength}ft > (recommended viewing distance), consider larger display or dual displays

    **B. AUDIO COVERAGE (AVIXA ACE):**
    - Conference rooms: 70dB SPL @ furthest seat
    - Auditorium: 85dB SPL minimum
    - Speaker spacing: Maximum 2× ceiling height = ${roomHeight * 2}ft apart
    - **Ceiling speaker calculation already done above: ${Math.ceil(roomArea / 175)} speakers required**

    **C. ACOUSTIC TREATMENT (If acousticNeeds = 'poor' or 'standard'):**
    - Target RT60: 0.6-0.8 seconds for conferencing
    - If room volume >3000 cu ft (current: ${roomVolume} cu ft) AND acousticNeeds='poor': MUST include treatment
    - Coverage: 15-25% of wall surface area
    - Acoustic treatment types selected: ${answers.acousticTreatmentType ? (Array.isArray(answers.acousticTreatmentType) ? answers.acousticTreatmentType.join(', ') : answers.acousticTreatmentType) : 'None specified'}

    **D. LIGHTING LEVELS (AVIXA DMD):**
    - Conference: 300-500 lux on faces
    - Display wall: <100 lux to avoid washout
    - If naturalLightLevel = 'high' (${answers.naturalLightLevel === 'high' ? 'YES' : 'NO'}): Motorized shades STRONGLY RECOMMENDED

5.  **QUANTITY CALCULATION RULES (EXACT FORMULAS):**
    
    **Displays & Mounts:** 1:1 ratio (each display needs exactly 1 mount)
    
    **Cables:**
    - HDMI/DP: (Number of sources) + 1 spare (minimum 2 total)
    - Speaker wire: 1 pair per speaker
    - CAT6A: (Network devices + VC codec + control panels + wireless presentation) + 2 spares
    - Power cords: 2× number of active devices (primary + backup)
    
    **Mounting Hardware:**
    - Wall anchors: 4-8 per display (depends on weight: <50lbs=4, 50-100lbs=6, >100lbs=8)
    - Rack screws/cage nuts: 4 per RU of equipment + 20% spare
    - Cable management: 1U horizontal organizer per 3-4 rack devices
    
    **Infrastructure:**
    - If (VC system + matrix switcher) present: MUST include managed network switch (8-24 port, PoE+ capable)
    - Rack shelves: 1 per non-rack-mount device (Mac Mini, media player, wireless presentation RX)
    - Rack ventilation: If >6U of active equipment, include 2U fan panel

6.  **MANDATORY INFRASTRUCTURE COMPONENTS (DO NOT SKIP):**
    
    **Cable Management (ALWAYS REQUIRED):**
    - Rack: Vertical cable managers (2 per rack), horizontal organizers (1 per 3U)
    - In-wall: J-hooks (if accessible ceiling), fire-stop putty (if fire-rated walls)
    - Table: Cable retractors or tethered cables for user-facing connections
    
    **Labeling & Documentation (AVIXA REQUIREMENT):**
    - Cable labels (both ends - source and destination)
    - Rack equipment labels
    - Include in "Accessories & Services": Professional labeling kit + as-built documentation
    
    **Testing & Commissioning (Budget 5-8% of hardware cost):**
    - AVIXA AVQ testing checklist compliance
    - System commissioning service
    - Include in "Accessories & Services"
    
    **Spare Parts Kit:**
    - 1 spare HDMI cable
    - 1 spare power cord
    - 1 spare remote control
    - If projector: 1 spare lamp
    
    **Installation Considerations:**
    - Wall construction: ${answers.wallConstruction || 'Standard drywall'}
    - Wall reinforcement: ${answers.wallReinforcement || 'Unknown'} - If 'no', include toggle anchors for drywall
    - Ceiling construction: ${answers.ceilingConstruction || 'Acoustic drop tile'}
    - Plenum requirement: ${answers.plenumRequirement === 'plenum_required' ? 'YES - All cables MUST be CMP rated' : 'No - CMR rated acceptable'}
    - Floor type: ${answers.floorType || 'N/A'} - If concrete + floor box needed, note core drilling service required

7.  **RACK UNIT (RU) PLANNING & LAYOUT:**
    - List each rack-mount component's RU height
    - **Proper Loading Order (bottom to top):**
      * Bottom: UPS, Power Conditioner, Heavy Amplifiers
      * Middle: Switchers, Processors, Network Switch, Control Processor
      * Upper: Patch Panels, Cable Management, Lightweight devices
    - Add 25% free space for airflow and future expansion
    - **Rack Size Selection:**
      * If total >20RU: Use 42U floor rack
      * If 10-20RU: Use 24U floor rack
      * If <10RU: Use 12U wall-mount or credenza rack
    - **Cooling Requirements:**
      * Calculate BTU/hr: Total Watts × 3.412
      * If rack BTU >1500: Include 2U rack-mount fan panel
      * If >3000 BTU: Flag for dedicated HVAC consideration (note in keyRemarks)

8.  **POWER BUDGET CALCULATION:**
    - Calculate: Total Device Wattage × 1.3 (inrush factor) ÷ 120V = Required Amperage
    - If >15A: MUST include note for dedicated 20A circuit in "Accessories & Services" category
    - Include sequenced rack PDU (8-12 outlets minimum)
    - Surge protection: Minimum 1000 Joules, recommended 3000+ Joules

9.  **COMPATIBILITY VERIFICATION:**
    - **HDMI Version Consistency:** All devices in signal chain must support same version (HDMI 2.0 for 4K@60Hz minimum)
    - **Audio Protocol Consistency:** If Dante used, ensure all audio devices are Dante-compatible OR include Dante AVIO adapters
    - **Control Protocol Support:** Verify all devices support chosen control protocol (RS-232, IP, CEC)
    - **Ecosystem Integration:** Flag if mixing incompatible ecosystems (e.g., Crestron control with Extron switchers = integration complexity, note in keyRemarks)

10. **TECHNICAL JUSTIFICATION (keyRemarks):**
    For each item, populate 'keyRemarks' with:
    - Top 3 reasons for selection
    - Key technical specifications or benefits
    - Why this specific item is optimal for this room configuration
    - Any AVIXA compliance notes
    Format as numbered list: "1. Reason one. 2. Reason two. 3. Reason three."

**STRICT OUTPUT ORDERING (SYSTEM FLOW):**
The returned JSON array MUST be sorted in this exact logical order:
1.  **Visual Systems:** Display(s) → Mount for each display → Power/Video Cables for each display → Video Wall Controller (if applicable)
2.  **Conferencing:** Codec/Bar → Camera → Camera Mount → Microphones → VC Licenses
3.  **Audio Systems:** Microphones → DSP → Amplifiers → Speakers → Speaker Cables → Audio Accessories
4.  **Connectivity & Distribution:** Switchers/Matrix → Extenders (TX/RX pairs) → Wireless Presentation → Wall Plates/Floor Boxes → Patch Cables
5.  **Infrastructure:** Rack → PDU/Power Conditioner → UPS (if required) → Network Switch → Rack Accessories (shelves, fans, cable mgmt) → Cabling (CAT6A, Fiber)
6.  **Control & Environment:** Control Processor → Touch Panel/Keypad → Lighting Control (if required) → Shade Control (if required)
7.  **Acoustic Treatment:** Wall Panels → Ceiling Clouds → Bass Traps (if applicable)
8.  **Accessories & Services:** Labeling, Documentation, Testing/Commissioning, Spare Parts, Installation Notes, Training

**Scope Limit:**
Generate items ONLY for these categories: ${allowedCategories.join(', ')}.

**OUTPUT FORMAT:**
Return ONLY a JSON array of objects with these exact fields:
- category: string (must match one of the allowed categories)
- itemDescription: string (detailed technical description including brand, model, key specs)
- keyRemarks: string (top 3 reasons for selection, technical justification, AVIXA compliance notes)
- brand: string (MUST match Mandatory Brand Compliance)
- model: string (specific model number)
- quantity: number (calculated using formulas above)
- unitPrice: number (realistic MSRP in INR/Rupees)
- totalPrice: number (quantity × unitPrice, will be recalculated)
- source: 'database' | 'web'
- priceSource: 'database' | 'estimated'

**FINAL VALIDATION BEFORE OUTPUT:**
- Every display has a mount
- Every source has appropriate cables based on distance
- Audio system has complete signal chain (mic → DSP → amp → speakers)
- If VC enabled: Camera + Codec + Mics + Speakers all present
- Power distribution adequate for total load
- Network infrastructure sufficient for IP devices
- Cable management and labeling included
- Installation considerations noted (wall type, plenum, etc.)
- All quantities calculated using formulas (not guessed)
- All components from specified brands (or professional defaults if none specified)
`;

  const responseSchema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        category: { type: "string" },
        itemDescription: { type: "string" },
        keyRemarks: { type: "string" },
        brand: { type: "string" },
        model: { type: "string" },
        quantity: { type: "number" },
        unitPrice: { type: "number" },
        totalPrice: { type: "number" },
        source: { type: "string", enum: ['database', 'web'] },
        priceSource: { type: "string", enum: ['database', 'estimated'] },
      },
      required: ['category', 'itemDescription', 'keyRemarks', 'brand', 'model', 'quantity', 'unitPrice', 'totalPrice', 'source', 'priceSource'],
    },
  };

  try {
    const response = await ai.getGenerativeModel({ model: model }).generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: `Custom Product Database (Filtered for Relevance): ${curatedDatabaseString}` }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const jsonText = cleanJsonOutput(response.response.text());
    const boq: BoqItem[] = JSON.parse(jsonText);

    return boq.map((item: BoqItem) => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));

  } catch (error) {
    console.error('Error generating BOQ:', error);
    try {
      const user = await getCurrentUser();
      await logActivity({
        userId: user.userId,
        userEmail: user.signInDetails?.loginId || 'unknown',
        action: 'GENERATION_FAILED',
        resourceType: 'BOQ',
        details: { error: error instanceof Error ? error.message : String(error), params: answers }
      });
    } catch (logError) {
      console.error('Failed to log generation failure:', logError);
    }
    throw error;
  }
};

/**
 * Refines an existing BOQ based on a user-provided prompt.
 */
export const refineBoq = async (currentBoq: Boq, refinementPrompt: string): Promise<Boq> => {
  const model = 'gemini-2.0-flash';
  const prompt = `Refine the following Bill of Quantities (BOQ) based on the user's request. You are a CTS-D certified AV architect with 25 years of experience.

    Current BOQ (JSON):
    ${JSON.stringify(currentBoq, null, 2)}

    User Request: "${refinementPrompt}"

    **INSTRUCTIONS:**
    1.  **User Authority:** The User Request overrides all previous logic. If they ask for a specific brand, model, or change, execute it exactly.
    2.  **Database Check:** When adding/swapping items, check the Custom Product Database first.
    3.  **Brand Lock:** If user asks to "Change all Audio to Bose", you MUST do so even if Bose is not in database. Use "Source: web, PriceSource: estimated" in that case.
    4.  **Priorities:**
        *   **Priority 1:** Database item matches functionality. If price missing, use item and set PriceSource='estimated'.
        *   **Priority 2:** If not in DB, search web but STRICTLY follow requested Brand.
    5.  **Technical Consistency:** Ensure system remains functional after changes:
        - Maintain signal flow integrity (if removing switcher, ensure direct connection works)
        - Verify compatibility (new display must work with existing cables/extenders)
        - Recalculate quantities if room dimensions implied (e.g., "bigger room" = more speakers)
    6.  **AVIXA Compliance:** Maintain all AVIXA standards:
        - Display viewing distances
        - Audio coverage calculations
        - Proper cable types for distances
        - Complete signal chains
    7.  **Field Requirement:** Ensure 'source', 'priceSource' are populated correctly.
    8.  **Key Remarks:** For any NEW or MODIFIED items, provide 'keyRemarks' explaining:
        - Top 3 reasons for selection/change
        - Technical benefits
        - How it improves the system
    9.  **Maintain Logical Ordering:** Keep items in proper system flow order (Displays → Mounts → Cables → VC → Audio → Infrastructure → Control → Acoustics → Accessories)
    
    **REFINEMENT SCENARIOS:**
    - "Add [item]": Insert in appropriate category, ensure integration with existing system
    - "Remove [item]": Delete and verify system still functions (e.g., removing switcher may require direct connections)
    - "Change [item] to [brand/model]": Swap item, verify compatibility, update price
    - "Upgrade [system]": Enhance to higher-tier components while maintaining brand preferences
    - "Make it cheaper": Suggest cost-effective alternatives without sacrificing core functionality
    - "Add more speakers/mics": Recalculate coverage based on room size, add appropriate quantity
    
    **VALIDATION AFTER REFINEMENT:**
    - Every display still has a mount
    - Signal chains remain complete
    - Cable lengths still appropriate for distances
    - Power budget still adequate
    - Network capacity sufficient
    - All new items have proper 'source' and 'priceSource' fields
    
    Return the complete, updated JSON array with all original items (unless explicitly removed) plus any additions/modifications.
    `;

  const responseSchema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        category: { type: "string" },
        itemDescription: { type: "string" },
        keyRemarks: { type: "string" },
        brand: { type: "string" },
        model: { type: "string" },
        quantity: { type: "number" },
        unitPrice: { type: "number", description: "MSRP in INR" },
        totalPrice: { type: "number" },
        source: { type: "string", enum: ['database', 'web'] },
        priceSource: { type: "string", enum: ['database', 'estimated'] },
      },
      required: ['category', 'itemDescription', 'keyRemarks', 'brand', 'model', 'quantity', 'unitPrice', 'totalPrice', 'source', 'priceSource'],
    },
  };

  try {
    // Extract valid categories from current BOQ to filter database
    const relevantCategories = [...new Set(currentBoq.map(item => item.category))];
    const curatedDatabaseString = getFilteredDatabaseString(relevantCategories);

    const response = await ai.getGenerativeModel({ model: model }).generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: `Custom Product Database (Filtered for Relevance): ${curatedDatabaseString}` }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
      },
    });

    const jsonText = cleanJsonOutput(response.response.text());
    const boq = JSON.parse(jsonText);

    return boq.map((item: BoqItem) => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));
  } catch (error) {
    console.error('Error refining BOQ:', error);
    try {
      const user = await getCurrentUser();
      await logActivity({
        userId: user.userId,
        userEmail: user.signInDetails?.loginId || 'unknown',
        action: 'GENERATION_FAILED',
        resourceType: 'BOQ_REFINE',
        details: { error: error instanceof Error ? error.message : String(error), prompt: refinementPrompt }
      });
    } catch (logError) {
      console.error('Failed to log refinement failure:', logError);
    }
    throw error;
  }
};

/**
 * Validates a BOQ against requirements and AVIXA best practices.
 */
export const validateBoq = async (boq: Boq, requirements: string): Promise<ValidationResult> => {
  const model = 'gemini-2.0-flash';
  const prompt = `You are an expert AV system design auditor (CTS-D, AVIXA Certified). Perform a comprehensive technical audit of this Bill of Quantities (BOQ).

    User Requirements: "${requirements}"

    Current BOQ (JSON):
    ${JSON.stringify(boq, null, 2)}

    **COMPREHENSIVE AUDIT CHECKLIST:**

    **1. BRAND COMPLIANCE AUDIT:**
    - Parse requirements for brand preferences (displayBrands, mountBrands, audioBrands, etc.)
    - **FAIL if:** User requested "Chief" mounts but BOQ contains "B-Tech"
    - **FAIL if:** User requested "Samsung" displays but BOQ contains "LG"
    - Flag ALL brand mismatches as CRITICAL warnings

    **2. SIGNAL FLOW INTEGRITY:**
    - **Display Chain:** Source → Cable → (Extender if >50ft) → Display
      * Missing: Source device, video cables, extenders for long runs, display power
    - **Audio Chain:** Mic → DSP/Mixer → Amp → Speakers
      * Missing: DSP (if VC enabled), amplifier (if passive speakers), speaker cables
      * CRITICAL: If mics + speakers present but NO DSP with AEC = Audio feedback risk
    - **VC Chain:** Camera → Codec → Network + Display
      * Missing: Camera mount, USB/HDMI cables, network switch (if IP-based)
    - **Control Chain:** Touch panel → Processor → Controlled devices
      * Missing: Control cables, processor power

    **3. MOUNTING VERIFICATION:**
    - Count displays: [X]
    - Count mounts: [Y]
    - **FAIL if X ≠ Y:** Every display needs exactly 1 mount
    - Verify mount type appropriate for wall construction (from requirements)
    - If glass wall + heavy display: Flag as installation concern

    **4. CABLE LENGTH VERIFICATION:**
    - Extract: roomLength, roomWidth, rackDistance from requirements
    - Calculate expected cable run: (roomLength + roomWidth + rackDistance) × 1.4
    - **FAIL if:** HDMI cable >50ft without extenders
    - **FAIL if:** Speaker cable gauge insufficient for distance (14AWG for 100ft @ 100W minimum)
    - Check: Plenum-rated cables if requirement specifies plenum

    **5. QUANTITY VALIDATION:**
    - **Ceiling Speakers:** Expected ~1 per 175 sq ft (calculate from room dimensions)
      * If BOQ has significantly different quantity, flag as warning
    - **Ceiling Microphones:** Expected ~1 per 225 sq ft (15ft coverage radius)
      * If BOQ quantity wrong, flag as warning
    - **Table Microphones:** Expected ~1 per 4 people
      * Verify against capacity in requirements
    - **Power Outlets:** Minimum 2× number of active devices
    - **Network Drops:** Count IP devices (codec, control panel, switch, wireless presentation) + 2 spares

    **6. POWER BUDGET VALIDATION:**
    - Sum all device wattages (estimate if not in BOQ)
    - Calculate: Total × 1.3 (safety factor) ÷ 120V = Amperage needed
    - **WARNING if >15A:** Recommend dedicated 20A circuit
    - Verify PDU/UPS capacity sufficient for calculated load

    **7. RACK SPACE VALIDATION:**
    - Sum all RU heights (estimate standard: Switcher=1U, Processor=2U, Amp=2-3U, etc.)
    - **FAIL if:** Total RU > Rack size specified
    - **WARNING if:** <25% free space (poor airflow/no expansion room)

    **8. AVIXA COMPLIANCE CHECKS:**
    - **Viewing Distance:** If room depth > display screen height × 1.5 (for 4K), flag as viewing distance issue
    - **Audio Coverage:** Verify speaker placement achieves 70dB SPL at furthest seat
    - **Camera FOV:** Verify camera can frame table width (should be × 1.2 of table)
    - **Acoustic Treatment:** If room >3000 cu ft + poor acoustics mentioned, treatment should be included

    **9. MISSING INFRASTRUCTURE COMPONENTS:**
    Check for these often-forgotten items:
    - Cable management (horizontal organizers, vertical managers)
    - Rack accessories (shelves, blanking panels, fan panels if >6U active gear)
    - Labels and documentation
    - Testing/commissioning service
    - Spare parts kit
    - Installation hardware (wall anchors, rack screws)
    - Fire-stop putty (if in-wall installation)

    **10. COMPATIBILITY MATRIX:**
    - HDMI versions consistent (all 2.0+ for 4K)
    - Audio protocol consistent (all Dante, or include Dante AVIO adapters)
    - Control protocol support (verify all devices controllable via chosen system)
    - Ecosystem compatibility (flag if mixing Crestron + Extron + AMX = complexity)

    **11. CODE COMPLIANCE:**
    - Plenum-rated cables if ceiling is return air plenum
    - UL-listed mounts for displays >50lbs
    - Fire-rated cables through fire barriers
    - NEC Article 640 compliance for audio systems

    **12. INSTALLATION FEASIBILITY:**
    - If glass wall + wall-mount display: Flag as requiring specialized glass mounts
    - If ceiling height >12ft + ceiling mics: Suggest pendant mics instead
    - If concrete floor + floor box: Note core drilling required (add to services)
    - If open ceiling + in-ceiling speakers: Note difficult installation

    **OUTPUT FORMAT:**
    Return JSON object with:
    - isValid: boolean (False if ANY critical issues exist - brand mismatch, missing signal chain components, dangerous configurations)
    - warnings: string[] (Critical and important issues - brand mismatches, missing components, signal flow breaks, code violations)
    - suggestions: string[] (Optimization recommendations - better products, cost savings, performance improvements)
    - missingComponents: string[] (Specific items that should be added - "HDBaseT extender for 80ft HDMI run", "Rack cable management", etc.)
    - score: number (0-100, overall BOQ quality - deduct points for each issue)
    - complianceNotes: string[] (AVIXA standard compliance observations)
    `;

  const responseSchema = {
    type: "object",
    properties: {
      isValid: { type: "boolean" },
      warnings: {
        type: "array",
        items: { type: "string" }
      },
      suggestions: {
        type: "array",
        items: { type: "string" }
      },
      missingComponents: {
        type: "array",
        items: { type: "string" }
      },
      score: { type: "number" },
      complianceNotes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ['isValid', 'warnings', 'suggestions', 'missingComponents', 'score', 'complianceNotes'],
  };

  try {
    const response = await ai.getGenerativeModel({ model: model }).generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const jsonText = cleanJsonOutput(response.response.text());
    const result = JSON.parse(jsonText);

    return {
      isValid: result.isValid,
      warnings: result.warnings || [],
      suggestions: result.suggestions || [],
      missingComponents: result.missingComponents || [],
      score: result.score || 0,
      complianceNotes: result.complianceNotes || []
    };

  } catch (error) {
    console.error('Error validating BOQ:', error);
    try {
      const user = await getCurrentUser();
      await logActivity({
        userId: user.userId,
        userEmail: user.signInDetails?.loginId || 'unknown',
        action: 'GENERATION_FAILED',
        resourceType: 'BOQ_VALIDATE',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    } catch (logError) {
      console.error('Failed to log validation failure:', logError);
    }
    return {
      isValid: false,
      warnings: ['AI validation failed to run. Please check the BOQ manually.'],
      suggestions: ['Retry validation or perform manual review.'],
      missingComponents: [],
      score: 0,
      complianceNotes: ['Validation system error - manual review required']
    };
  }
};

/**
 * Fetches product details using Google Search grounding.
 */
export const fetchProductDetails = async (productName: string): Promise<ProductDetails> => {
  const model = 'gemini-2.5-flash';
  const prompt = `Provide a comprehensive technical and functional overview for the AV product: "${productName}". 
    
    Include:
    - Key technical specifications (resolution, frequency response, connectivity, power, etc.)
    - Primary use cases and room types
    - Notable features or technologies
    - Integration capabilities
    
    The description should be professional and suitable for a customer proposal (2-3 paragraphs).
    
    After the description, on a new line, write "IMAGE_URL:" followed by a direct URL to a high-quality, front-facing product image if available.
    `;

  try {
    const response = await ai.getGenerativeModel({ model: model }).generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.response.text();
    let description = text;
    let imageUrl = '';

    const imageUrlMatch = text.match(/\nIMAGE_URL:\s*(.*)/);
    if (imageUrlMatch && imageUrlMatch[1]) {
      imageUrl = imageUrlMatch[1].trim();
      description = text.substring(0, imageUrlMatch.index).trim();
    }

    const groundingChunks = undefined;

    const sources: GroundingSource[] = [];

    return {
      description,
      imageUrl,
      sources,
    };
  } catch (error) {
    console.error(`Error fetching product details for "${productName}":`, error);
    throw new Error(`Failed to fetch product details for "${productName}".`);
  }
};

/**
 * Creates a dedicated chat session for the GenBOQ assistant.
 */
export const createGenBoqChat = () => {
  const model = 'gemini-2.5-flash';
  const systemInstruction = `You are the helpful AI assistant for GenBOQ, an intelligent application for generating Audio-Visual Bill of Quantities (BOQ).

**Your Goal:** Help users understand how to use GenBOQ, explain its features, provide AV system design advice, and guide them through the BOQ generation process.

**App Overview:**
GenBOQ helps AV professionals, sales engineers, and consultants create detailed, AVIXA-compliant equipment lists and proposals quickly.

**Key Features & Workflow:**
1.  **Project Details:** Users enter client info, project name, and location in the "Project Details" tab.
2.  **Room Configuration:** 
    - Users add rooms using the "Add Room" button (left sidebar).
    - They can start from scratch or use templates like Huddle Room, Conference Room, Boardroom, etc.
3.  **Comprehensive Questionnaire:** 
    - For each room, users fill out a detailed questionnaire covering:
      * Room dimensions, capacity, seating arrangement
      * Display requirements (size, quantity, technology)
      * Video conferencing needs (BYOD vs dedicated system)
      * Audio system (mics, speakers, DSP)
      * Connectivity (wired/wireless presentation)
      * Control system preferences
      * Infrastructure (racks, power, network, wall/ceiling construction)
      * Acoustic treatment needs
    - This data drives the AI generation engine.
4.  **Generate BOQ:** 
    - Clicking "Generate BOQ" uses Gemini AI with advanced AVIXA-compliant logic to:
      * Select appropriate products based on room size, usage, and preferences
      * Calculate quantities using professional formulas (speaker coverage, mic placement, cable lengths)
      * Ensure complete signal chains (display, audio, video conferencing)
      * Follow brand preferences strictly
      * Include infrastructure (mounts, cables, racks, power distribution)
    - The AI respects brand preferences (e.g., "Use Samsung displays", "Shure audio only")
5.  **Refine with AI:** 
    - Users can modify the BOQ using natural language:
      * "Change all displays to LG"
      * "Add a second camera"
      * "Remove the wireless presentation system"
      * "Make it more cost-effective"
      * "Upgrade the audio system"
6.  **Web Search:** 
    - Users can search for specific products online and add them directly to the BOQ if not in the internal database.
7.  **Validate BOQ:** 
    - The "Validate BOQ" button runs a comprehensive AI audit checking:
      * Brand compliance (did AI use requested brands?)
      * Signal flow integrity (are all connections complete?)
      * Missing components (mounts, cables, infrastructure)
      * AVIXA standards compliance (viewing distances, audio coverage, cable types)
      * Installation feasibility
    - Returns warnings, suggestions, missing components, and a quality score
8.  **Project Controls (Left Sidebar):**
    - **Save/Load Project:** Save entire project (all rooms, questionnaires, BOQs) to browser storage
    - **Company Branding:** Upload company logo and set brand colors for professional exports
    - **Compare Rooms:** Side-by-side comparison of BOQs from two different rooms
    - **Export to XLSX:** Downloads professional Excel proposal with:
      * Custom cover sheet with company branding
      * Project information summary
      * Version control and revision tracking
      * Detailed BOQ with categories, quantities, prices
      * Automatic calculations and totals

**Technical Capabilities:**
- AVIXA CTS-D compliant signal flow logic
- Distance-based cable and extender selection
- Automatic quantity calculations (speakers per sq ft, mics per person, etc.)
- Power budget and rack space calculations
- Acoustic coverage formulas
- Display viewing distance verification
- Complete infrastructure planning (racks, power, network)

**Best Practices You Can Advise:**
- Accurate room dimensions are crucial for cable length calculations
- Always specify brand preferences to get consistent system design
- Include plenum requirement for proper cable specification
- Specify wall/ceiling construction for appropriate mounting hardware
- For large rooms (>500 sq ft), consider multiple audio zones
- For video conferencing, always include DSP with AEC (Acoustic Echo Cancellation)
- Budget 5-8% of hardware cost for testing and commissioning

**Tone:** Professional, knowledgeable, concise, and helpful.

**Constraint:** You cannot directly manipulate the UI or click buttons for the user, but you can guide them step-by-step on exactly what to do.

If asked to generate a BOQ, tell them: "Fill out the room questionnaire completely (all 10 sections), then click the 'Generate BOQ' button. The more detailed your answers, the more accurate the BOQ will be."

If asked about missing items, suggest: "Use the 'Validate BOQ' button to run a comprehensive audit. It will identify any missing components and provide specific recommendations."

If asked about modifying the BOQ, explain: "Use the 'Refine with AI' feature. Just type your request in natural language like 'add a second display' or 'change audio brand to QSC' and the AI will update the entire BOQ accordingly."`;

  const genModel = ai.getGenerativeModel({ model: model });
  const chat = genModel.startChat();

  // Add system instruction to the chat history by starting with a note
  // Note: In the newer SDK, system instructions are passed during generateContent
  return chat;
};
