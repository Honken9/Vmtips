# VM-Tips 2026

Tipstävling för FIFA World Cup 2026. Byggt med Next.js 14 + Supabase.

## Kom igång

### 1. Installera beroenden
```bash
cd vm-tips
npm install
```

### 2. Skapa Supabase-projekt
1. Gå till [supabase.com](https://supabase.com) och skapa ett nytt projekt
2. Gå till **SQL Editor** och kör `supabase/schema.sql`
3. Kör sedan `supabase/seed.sql` för att fylla i lag och matcher

### 3. Miljövariabler
Kopiera `.env.local.example` till `.env.local` och fyll i dina Supabase-uppgifter:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-nyckel
```
Dessa hittar du under **Project Settings → API** i Supabase.

### 4. Starta appen
```bash
npm run dev
```
Öppna [http://localhost:3000](http://localhost:3000)

### 5. Skapa admin-konto
1. Registrera ett konto via `/auth/register`
2. Gå till Supabase Dashboard → Table Editor → `profiles`
3. Sätt `is_admin = true` för ditt konto

---

## Turneringslägen

| Läge | Beskrivning |
|------|-------------|
| **A** | Alla tippar hela turneringen på en gång. Klickar "Lämna in" för att låsa. Admin kan låsa globalt. |
| **B** | Tips per match. Låses automatiskt vid avspark. |

Byt läge under **Admin → Inställningar**.

---

## Poängsystem (standard)

| Händelse | Poäng |
|----------|-------|
| Rätt tecken (1/X/2) | 3p |
| Exakt rätt resultat | 5p |
| Rätt mästare (bonus) | 10p |
| Rätt finalist (bonus) | 5p |

Kan justeras under **Admin → Inställningar**.

---

## Driftsättning (Vercel)

```bash
npm install -g vercel
vercel
```
Lägg till miljövariablerna under **Project Settings → Environment Variables** i Vercel.

---

## Uppdatera matchschema

Seed-filen (`supabase/seed.sql`) innehåller grupp A–C och slutspelsmatcher.
Lägg till grupp D–L på samma sätt, eller uppdatera direkt i Supabase Table Editor.

OBS: Verifiera kickoff-tider mot officiellt FIFA-schema.
