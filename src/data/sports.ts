// src/data/sports.ts
export const SPORTS_TAXONOMY: string[] = [
    // Endurance / athlé
    "Course à pied", "Sprint", "Demi-fond", "Fond", "Marathon", "Trail", "Ultra-trail",
    "Triathlon", "Duathlon", "Aquathlon", "Ironman",
    "Marche", "Marche nordique",
  
    // Muscu / fitness
    "Musculation", "Hypertrophie", "Force", "Powerlifting", "Haltérophilie",
    "CrossFit", "Fitness", "HIIT", "Calisthenics", "Street workout",
    "Kettlebell", "Strongman", "Functional training",
  
    // Mobilité / santé
    "Mobilité", "Souplesse", "Étirements", "Réathlétisation", "Rééducation",
    "Préparation physique", "Prévention blessures",
  
    // Vélo
    "Cyclisme", "VTT", "Vélo de route", "Gravel", "BMX", "Piste", "Cyclo-cross",
    "Spinning",
  
    // Natation / eau
    "Natation", "Eau libre", "Water-polo", "Apnée", "Plongée", "Aviron",
    "Canoë-kayak", "Stand up paddle", "Surf", "Bodyboard", "Kitesurf", "Windsurf",
    "Wakeboard",
  
    // Sports co
    "Football", "Futsal", "Basket-ball", "Handball", "Volley-ball", "Beach-volley",
    "Rugby", "Rugby à 7", "Hockey", "Hockey sur glace", "Baseball", "Softball",
    "Cricket", "Lacrosse",
  
    // Raquette
    "Tennis", "Padel", "Squash", "Badminton", "Tennis de table",
  
    // Combat
    "Boxe", "Kickboxing", "Muay thaï", "MMA",
    "Judo", "Karate", "Taekwondo", "Jiu-jitsu brésilien", "Lutte", "Aïkido",
    "Escrime",
  
    // Danse / corps-esprit
    "Yoga", "Pilates", "Danse", "Zumba", "Barre au sol",
    "Gymnastique", "GAF", "GAM",
  
    // Hiver / montagne
    "Ski alpin", "Ski de fond", "Snowboard", "Biathlon", "Patinage", "Hockey sur glace",
    "Escalade", "Bloc", "Alpinisme", "Randonnée", "Trekking", "Via ferrata",
  
    // Autres
    "Golf", "Équitation", "Athlétisme", "Saut", "Lancers",
    "Perte de poids", "Prise de masse", "Endurance", "Recomposition corporelle",
  ]
// Liste finale utilisée par l’app (dédupliquée + tri FR)
export const SPORTS: string[] = Array.from(new Set(SPORTS_TAXONOMY)).sort(
  new Intl.Collator('fr', { sensitivity: 'base' }).compare
)
