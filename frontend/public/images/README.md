# Logo Setup Instructions

## Add SGU Logo to Splash Screen

### Steps:

1. **Save your SGU logo image** as `sgu-logo.png` in this folder:
   ```
   d:\attend\frontend\public\images\sgu-logo.png
   ```

2. **Image Requirements:**
   - Format: PNG with transparent background (preferred) or JPG
   - Size: Recommended 512x512px or higher
   - The logo will be displayed at 224x224px (56 in Tailwind = 224px)

3. **Alternative Image Names:**
   If you want to use a different filename, update line 77 in:
   `frontend/src/components/SplashScreen.jsx`
   
   Change:
   ```jsx
   src="/images/sgu-logo.png"
   ```
   
   To your filename:
   ```jsx
   src="/images/your-logo-name.png"
   ```

### Fallback Design:
If the image doesn't load, a fallback SVG shield logo will display automatically with:
- 5 red stars
- "SGU" text
- Sun icon
- "INCUBATION CENTRE" text

### Current Splash Screen Design:
✅ White background (clean, professional)
✅ SGU red color scheme (#dc2626)
✅ Rotating red ring around logo
✅ "Innovate. Create. Grow." tagline
✅ Red progress bar
✅ "Made by Engiigenius" animation (red theme)

---

## Quick Test:
After adding the logo, refresh your browser to see the splash screen with your logo!
