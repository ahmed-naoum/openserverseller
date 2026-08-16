import fs from 'fs';
import path from 'path';

// Parse the Coliaty dataset from API response
const coliatyJsonPath = path.join(process.cwd(), 'scripts', 'cities', 'data', 'coliaty-cities.json');
const coliatyRaw: any[] = JSON.parse(fs.readFileSync(coliatyJsonPath, 'utf8'));

// Slug function
function normalizeCity(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_.,'’`\s()\/]/g, '')
    .replace(/ou/g, 'o')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/ii/g, 'i')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'sh');
}

function basicSlug(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// 444 cities by Hub from the PDF
const PDF_HUBS: Record<string, { cities: string[]; unplaced: string[] }> = {
  'AGADIR': {
    cities: [
      'Houara', 'Inzegane', 'Foum Zguid', 'Tagadirt', 'Tata', 'Akka-Tata', 'Taliouine', 'Tamanart - TATA', 'Aoulouz', 'Sidi Ifni',
      'Igherm', 'Oulad Berhil', 'Mirleft', 'Anzi-tiznit', 'Aoulad jerar-TIZNIT', 'Idaousmlal-tiznit', 'Tiznit', 'Tafraouten', 'Aglou',
      'Ait Iaaza', 'Taroudant', 'Massa', 'Sebt Guerdane', 'Ait Baha', 'Nouasser-belfaa', 'Belfaa', 'Taghazout', 'Tamraght', 'Aourir',
      'Ouled-Teima', 'Anza', 'Aït Amira', 'Khemis Ait Amira', 'Biougra', 'Taddart - AGADIR', 'Agadir', 'Sidi Bibi', 'Dcheïra', 'Temsia',
      'Drargua', 'Lqliâa', 'Tikiouine', 'Aït Melloul'
    ],
    unplaced: ['Azro agadir', 'Lakhessas', 'Tamaait']
  },
  'BENIMELLAL': {
    cities: [
      'Ouled Moussa', 'Wawizeght', 'Adouz', 'Kamoun', 'Timlilt', 'Souk Sebt', 'Mghila', 'Lahri', 'Ait Hattab', "M'rirt", 'Tanant',
      'El Borj-KHENIFRA', 'El Kbab', 'El Kebab-KHENIFRA', 'Aguelmous', 'Lehri-KHENIFRA', 'Khénifra', 'Moulay Bouazza', 'Moulay Bouazza Khenifra',
      'Azilal', 'Ouzoud', 'Aït Ishaq', 'Khouribga', 'Dar Oulad Zidouh', 'Oulad Ayad', 'Ouaoumana', 'Kaf Nsour', 'Boujniba', 'Hattane-Khouribga',
      'Bni Ayat', 'Afourar', 'Sebt Oulad Nemma', 'Zaouiat Cheikh', 'Oulad Mrah', 'Oulad Zmam', 'Sidi Aissa-Beni-Mellal', 'Oued Zem', 'Foum Oudi',
      'El Ksiba', 'Tanougha-Beni Mellal', 'Fkih Ben Salah', 'Tachrafat', 'Beni Mellal', 'El Bradia', 'Ighram Laalam-Beni Mellal', 'Sidi Jaber',
      'Faryata', 'Tagzirt', 'Bejaad', 'Ait Ali', 'Ait Rbaa', 'Kasba Tadla'
    ],
    unplaced: [
      'Aglmous', 'Bezaza', 'Bonouar', 'El Ayayta', 'Fom Anser', 'Foum Zaouia', 'Kraza', 'Oulad Borhmoun', 'Oulad I3ich', 'Oulad Zidoh',
      'Tighassaline ville', 'Tighsalin', 'Zawit Chikh', 'Zwayr'
    ]
  },
  'OUJDA': {
    cities: [
      'Afra', 'El aroui', 'Figuig', 'Bouarfa', 'Krona', 'Tendrara', 'Oued Amlil-OUJDA', 'Aïn Bni Mathar', 'Had Msila', 'Jerada',
      'Oujda', 'Bni Drar', 'Ahfir', 'Boudinar', 'Saïdia', 'Aïn Reggada', 'Taourirt', 'Berkane', 'Midar', 'Tafersit', 'Madagh',
      'Ras El Ma - NADOR', 'Ben Taieb oujda', 'Boughriba', 'Driouch', 'Beni Oukil', 'Aklim', 'Dar el Kebdani', 'Mariouari', 'Beni Chiker',
      'Farkhana', 'Beni Ansar', 'Beni Ensar', 'Bni Sidel Jbel', 'Kariat Arekmane', 'Tiztoutine', 'Nador', 'Jaadar', 'Zaïo', 'Zeghanghane',
      'Ouled Settout', 'Taouima', 'Bouarg', 'Selouane'
    ],
    unplaced: ['Al Aruit', 'Barichino', 'Bouaanan', 'Ihdadn', 'Laayoune Charkiya', 'Tamsman']
  },
  'LAAYOUNE': {
    cities: [
      'Dakhla', 'Boujdour', 'Assa', 'Bouizakarne', 'Guelmim', 'Laâyoune', 'Es-Semara', 'Tarfaya', 'Tan-Tan', 'El Ouatia', 'Akhfennir'
    ],
    unplaced: ['El Marssa Laayoune', 'Laayoun Port', 'Tagant Klimmi']
  },
  'FES': {
    cities: [
      'Goulmane', 'Guercif', 'Missour', 'Outat El Haj', 'Taddart-Guercif', 'Timahdite', 'Taza', 'Imouzzer Marmoucha', 'Boulemane',
      'Ghafsai', 'Taounate', 'Oued Amlil', 'Karia Ba Mohamed', 'Ribate El Kheir', 'Tahla', 'El Menzel - Sefrou', 'Imouzzer-Kandar - FES',
      'Moulay Yacoub', 'Ain Allah', 'Ras El Ma-FES', 'Ain Chkef - FES', 'Sefrou', 'Bhalil', 'Douiyat - FES', 'Fès', 'Oulad Tayeb - FES',
      'Sidi Hrazem', 'Ain Bida Fes'
    ],
    unplaced: ['Ain Chgag', 'Ain Na9bi', 'Khelallefa', 'Tissa Taounat']
  },
  'MARRAKECH': {
    cities: [
      'Ouled Yahia', 'Douar Soultan', 'Douar Bouaaza', 'Aghmat', 'Lagoussem', 'Imintanoute', 'Sidi El Mokhtar', 'Skhour Rhamna', 'Demnate',
      'Chichaoua', 'El Kelaâ des Sraghna', 'El Attaouia', 'Majjat', 'Amizmiz', 'Mzoudia', 'Tamelelt', 'Asni', 'Sid Zouine', 'Loudaya',
      'Ourika', 'Tahannaout', 'Sidi Bou Othmane', 'Ait Ourir', 'Tameslouht', 'Souihla', 'Tamansourt', 'Sidi Abdallah Ghiat', 'Chouiter',
      'Sidi Moussa MARRAKECH', 'Ouahat Sidi Brahim', 'Oulad Hassoun', 'Marrakech'
    ],
    unplaced: ['Belaaguid', 'Ben Gruir', 'Ouled Yhya', 'Sabt Mzouda']
  },
  'OUARZAZAT': {
    cities: [
      'Tazarine', 'Alnif', 'Tinghir', 'Nkoub-ZAGORA', 'Zagora', 'Boumalne Dadès', 'Kalaat M\'Gouna', 'Taznakht', 'Agouim-OUARZAZAT',
      'Ighrem N\'Ougdal', 'Télouet', 'Skoura', 'Ait Zineb', 'Aït Ben Haddou', 'Ouarzazate'
    ],
    unplaced: ['Agdez Zagora', 'Boumaln', 'Idlsan']
  },
  'ERRACHIDIA': {
    cities: [
      'Aghbalou', 'Itzer', 'Zaida', 'Boumia', 'Merzouga', 'Boudnib', 'Midelt', 'Rissani', 'Arfoud', 'Tinejdad', 'Rich - Errachidia',
      'Aoufous', 'Goulmima', 'Errachidia'
    ],
    unplaced: []
  },
  'Meknes': {
    cities: [
      'Bridia', 'Ain kerma', 'Ain Leuh', 'Sidi Addi', 'Azrou IFRAN', 'Ifrane', 'Agourai', 'El Hajeb', 'Ain Taoujdate', 'Mhaya - Meknes',
      'Ait Yaazem', 'Ain Karma', 'Moulay Idriss Zerhoun', 'Boufekrane', 'El Baraka - Meknes', 'Haj Kadour', 'Oued Jdida', 'Sabaâ Aïyoun - Meknes',
      'Meknès', 'Dkhissa', 'Dkhissa-fes'
    ],
    unplaced: ['Bouderbala', 'Ouisslan']
  },
  'SAFI': {
    cities: [
      'El Youssoufia', 'Tamanart - SAFI', 'Tamanar', 'Smimou', 'Youssoufia', 'El Ghazoua', 'Chemaia', 'Echemmaia', 'Essaouira',
      'Jamaat Shaim', 'Had Hrara', 'Ounagha', 'Had Dra', 'Safi', 'Sebt Gzoula', 'Bir Kouat', 'Souiria', 'Talmest'
    ],
    unplaced: []
  },
  'CASABLANCA': {
    cities: [
      'Sidi Rehal', 'Tamaris', 'Bouznika', 'Had Soualem', 'Benslimane', 'Dar Bouazza', 'Mansouria', 'Errahma', 'Bouskoura', 'Mohammédia',
      'Louizia', 'Casablanca', 'Chellalate', 'Ain Harrouda', 'Lahraouiyine', 'Tit Mellil'
    ],
    unplaced: ['Ben yakhelf', 'Sbitt']
  },
  'EL JADIDA': {
    cities: [
      'Moulay Abdellah', 'Tnine Gharbia zemamra', 'Loualidia', 'Bir Jdid', 'Khemis Des Zemamra', 'Sidi Bennour', 'Tnine Chtouka (el jadida)',
      'Ouled Ghanem', 'Haouzia', 'Azemmour', 'Oulad Frej', 'Sidi Smaïl', 'El Jadida', 'Sidi Bouzid', 'Sidi Abed'
    ],
    unplaced: []
  },
  'Kenitra': {
    cities: [
      'Tizi Ayache', 'Sidi Taibi', 'Mehdia', 'Moulay Bousselham', 'Kénitra', 'Lalla Mimouna', 'Sidi Kacem', 'Khnichet', 'Souk El Arba Du Gharb',
      'Sidi Allal Tazi', 'Sidi Slimane', 'Sidi Yahya du Gharb', 'Mechra Bel Ksiri', 'Dar Gueddari'
    ],
    unplaced: ['Dlalha', 'Wlad Oujih']
  },
  'Khemisset - Tifelt': {
    cities: [
      'Tifrelt', 'Al Kamoun', 'Sidi Allal El Bahraoui', 'Khémisset', 'Oulmès', 'Rommani', 'Maaziz', 'Tiddas'
    ],
    unplaced: []
  },
  'Settat - Berchid': {
    cities: [
      'Lgara', 'Médiouna', 'Guisser- Settat', 'Oulad Abbou Settat', 'Deroua', 'Nouaceur', 'Ben Ahmed - Settat', 'Oulad Said Settat',
      'Sidi Hajjaj - Settat', 'Berrechid', 'El bourouj- settat', 'Settat'
    ],
    unplaced: ['Ras elaain settat']
  },
  'TANGER': {
    cities: [
      'Ain Bida', 'Fnideq', 'Ksar Sghir', 'Tanger', 'M\'Diq', 'Assilah', 'Jorf El Melha', 'Martil', 'Larache', 'Khemis Sahel',
      'Stehat-Chefchaouen', 'Tétouan', 'Al aouamra', 'Laouamra', 'Had Kourt', 'Oued Laou', 'Bab Berred', 'Aïn Dorij', 'Ain Defali',
      'Arbaoua', 'Bni Ahmed - chefchaoun', 'Ounnana', 'Sidi Redouane', 'Ksar el-Kebir', 'Masmouda', 'Zoumi-Ouazzane', 'Ouezzane',
      'Bou Jedyane', 'Bab Taza', 'Chefchaouen', 'Dardara', 'Brikcha'
    ],
    unplaced: ['Khmis elmduiaq']
  },
  'AL HOCEIMA': {
    cities: [
      'Issaguen', 'Ajdir- al houcaima', 'Targuist', 'Beni Boufrah', 'Al Hoceïma', 'Beni Bouayach', 'Imzouren', 'Bni Hadifa', 'Aït Kamra', 'Rouadi'
    ],
    unplaced: ['Boukidarn - houcaima']
  },
  'RABAT': {
    cities: [
      'Ain Atiq', 'Sidi Bouknadel', 'Salé El Jadida', 'Salé', 'Ain Aouda', 'Rabat', 'SIDI CHAFII-Rabat', 'Skhirat', 'Sidi Yahya Zaer',
      'Tamesna', 'Harhoura', 'Mers El Kheir', 'Témara'
    ],
    unplaced: []
  }
};

// Known custom aliases mapping from PDF to Coliaty API spellings
const MANUAL_ALIASES: Record<string, string> = {
  'Tafraouten': 'Tafraoute',
  'Taroudant': 'Taroudannt',
  'Sebt Guerdane': 'Sebt El Guerdane',
  'Aourir': 'Awrir',
  'Ouled-Teima': 'Oulad Teima',
  'Biougra': 'Biogra',
  'Drargua': 'Drarga',
  'Aït Melloul': 'Ait Meloul',
  'Moulay Bouazza': 'molay bouaza',
  'Aït Ishaq': 'Ait IshaK',
  'Dar Oulad Zidouh': 'dar ouled zidoh',
  'Bni Ayat': 'Beni Ayat',
  'Fkih Ben Salah': 'Fquih Ben Salah',
  'Faryata': 'Feryata',
  'Tagzirt': 'Tagzert',
  'Aïn Bni Mathar': 'Ain Beni Mathar',
  'Aïn Reggada': 'Ain Regada',
  'Tafersit': 'Taferssit',
  'Driouch': 'Driouich',
  'Dar el Kebdani': 'Dar Kebdani',
  'Beni Chiker': 'Bni Chiker',
  'Ouled Settout': 'Oulad Setout',
  'El Ouatia': 'Elouatya',
  'Imouzzer Marmoucha': 'Imouzar Marmoucha',
  'Karia Ba Mohamed': 'Kariat Ba Mohamed',
  'Sidi Hrazem': 'Sidi Harazem',
  'Sidi El Mokhtar': 'Sidi Lmoukhtar',
  'Skhour Rhamna': 'Skhour Rehamna',
  'El Attaouia': 'El Aataouia',
  'Majjat': 'Mejjat',
  'Sid Zouine': 'Sidi Zouine',
  'Tamansourt': 'Tamnsourt',
  'Sidi Abdallah Ghiat': 'Sidi Abdellah Ghiat',
  'Oulad Hassoun': 'Ouled Hassoun',
  'Boumalne Dadès': 'Boumaln Dadas',
  'Aït Ben Haddou': 'Ait Benhdou',
  'Ouarzazate': 'Ouarzazat',
  'Arfoud': 'Erfoud',
  'Tinejdad': 'Tinjdad',
  'Boufekrane': 'Boufakrane',
  'Haj Kadour': 'Haj Kaddour',
  'Tamanar': 'Temanar',
  'Jamaat Shaim': 'Jemâa-Shaim',
  'Had Dra': 'Had Draa',
  'Bir Kouat': 'Birkouate',
  'Benslimane': 'BEN SLIMAN',
  'Dar Bouazza': 'Dar Bouaza',
  'Chellalate': 'Chellalat',
  'Lahraouiyine': 'lahraouiyin',
  'Tit Mellil': 'Tit Melil',
  'Loualidia': 'oualidia',
  'Ouled Ghanem': 'Oualed ghanem',
  'Khnichet': 'Khenichet',
  'Souk El Arba Du Gharb': 'Souk Elarbaa Du Gharb',
  'Sidi Yahya du Gharb': 'Sidi Yahya El Gharb',
  'Al Kamoun': 'Al Kamouni',
  'Berrechid': 'Berrchid',
  'Oued Laou': 'Ouad Laou',
  'Masmouda': 'Mesmouda',
  'Ouezzane': 'Ouazzane',
  'Bou Jedyane': 'Boukedrane',
  'Dardara': 'DERDARA',
  'Beni Boufrah': 'Bni Boufrah',
  'Beni Bouayach': 'Bni Bouayach',
  'Aït Kamra': 'Ait Kamara',
  'Goulmane': 'Boulmane',
  'Ouled Yahia': 'oulad yahya',
  'Tifrelt': 'tifelt',
  'Wawizeght': 'wawizght',
  'El Youssoufia': 'El Yousoufia',
  'Timlilt': 'Timolilt',
  'Lgara': 'LGARA',
  'Tendrara': 'Tandrara',
  'Tizi Ayache': 'Sidi Ayache',
  'Laâyoune': 'Laayoune',
  'Souk Sebt': 'souk sebt',
  'Lahri': 'lahri',
  'Es-Semara': 'Essmara',
  'Tarfaya': 'Terfaya',
  'Ait Hattab': 'Ait Attab'
};

const results: any[] = [];
let matchedCount = 0;
let unmatched: string[] = [];

for (const [hubName, hubData] of Object.entries(PDF_HUBS)) {
  const allHubCities = [
    ...hubData.cities.map(c => ({ name: c, isUnplaced: false })),
    ...hubData.unplaced.map(c => ({ name: c, isUnplaced: true }))
  ];

  for (const item of allHubCities) {
    const raw = item.name.trim();
    const aliasTarget = MANUAL_ALIASES[raw];

    let match = coliatyRaw.find(c => c.city_name.trim().toLowerCase() === raw.toLowerCase());
    
    if (!match && aliasTarget) {
      match = coliatyRaw.find(c => c.city_name.trim().toLowerCase() === aliasTarget.toLowerCase());
    }

    if (!match) {
      const bSlug = basicSlug(raw);
      match = coliatyRaw.find(c => basicSlug(c.city_name) === bSlug);
    }

    if (!match) {
      const nSlug = normalizeCity(raw);
      match = coliatyRaw.find(c => normalizeCity(c.city_name) === nSlug);
    }

    if (match) {
      matchedCount++;
      results.push({
        pdfCity: raw,
        pdfHub: hubName,
        isUnplaced: item.isUnplaced,
        carrierCityId: match.city_id,
        carrierCityName: match.city_name,
        carrierCityCode: match.city_code,
        carrierHubName: match.hub_name,
        status: 'MATCHED'
      });
    } else {
      unmatched.push(`[${hubName}] ${raw}`);
      results.push({
        pdfCity: raw,
        pdfHub: hubName,
        isUnplaced: item.isUnplaced,
        status: 'NOT_FOUND'
      });
    }
  }
}

console.log('================================================================');
console.log('📊 FINAL COLIATY CITIES VERIFICATION RESULT');
console.log('================================================================');
console.log(`Total cities audited from PDF: ${results.length}`);
console.log(`Total matched in Coliaty API: ${matchedCount} / ${results.length} (${((matchedCount / results.length) * 100).toFixed(1)}%)`);
console.log(`Unmatched count: ${unmatched.length}`);

if (unmatched.length > 0) {
  console.log('\n❌ Unmatched cities:');
  unmatched.forEach(u => console.log('  -', u));
} else {
  console.log('\n🎉 ALL 444 CITIES IN THE PDF ARE 100% AVAILABLE IN COLIATY API!');
}

console.log('================================================================');
