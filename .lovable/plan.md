## Στόχος
Μετακίνηση του `CostingNotificationsBell` από το πάνω-δεξιά μέρος του περιεχομένου (`absolute top-4 right-6`) μέσα στο sidebar του Costing module, κάτω από το header "SKYNET / Costing", ώστε να είναι ορατό σε όλες τις σελίδες του module όταν το sidebar είναι ανοιχτό.

## Αλλαγές

### 1. `src/pages/costing/CostingLayout.tsx`
- **Αφαίρεση**: Το `<div className="absolute top-4 right-6 z-20"><CostingNotificationsBell /></div>` από το `<main>`.
- **Προσθήκη**: Μετά το header block (`p-6 border-b border-sidebar-border`) και πριν το `<nav>`, προσθήκη ενός block που περιέχει το `<CostingNotificationsBell />` με οριζόντια διάταξη και padding για να ταιριάζει στο sidebar styling.

### 2. `src/components/costing/CostingNotificationsBell.tsx`
- **Προσαρμογή**: Αλλαγή του `align` στο `<PopoverContent>` από `align="end"` σε `align="start"` (ή κατάλληλη τιμή) ώστε το dropdown να ανοίγει προς τα κάτω και δεξιά χωρίς να βγαίνει εκτός sidebar.

## Τεχνικές λεπτομέρειες
- Το bell θα εμφανίζεται μόνο όταν το sidebar είναι σε expanded κατάσταση (default σε desktop). Σε collapsed/mobile state, δεν θα είναι ορατό — αυτό είναι αποδεκτό γιατί το module sidebar δεν έχει mini/collapsed variant.
- Το styling θα ακολουθεί τα υπάρχοντα tokens του project (`text-sidebar-foreground`, `hover:bg-white/10`, κλπ.) για ομοιομορφία με τα nav items.