import type { Metadata } from 'next';
import CityPageClient from './CityPageClient';

interface CityData {
  city: string;
  slug: string;
  region: string;
  heroImage: string;
  heroImageAlt: string;
  tagline: string;
  description: string;
  stats: { label: string; value: string }[];
  services: { icon: string; title: string; description: string }[];
  areas: string[];
  faqs: { question: string; answer: string }[];
  nearbyLinks: { city: string; slug: string }[];
}

const cityData: Record<string, CityData> = {
  london: {
    city: 'London',
    slug: 'london',
    region: 'Greater London & Home Counties',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20London%20commercial%20building%20entrance%20with%20iconic%20glass%20architecture%20and%20city%20lights%20in%20the%20background%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20London%20architecture%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_london_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in London",
    tagline: "Find SIA-licensed applicants for security shifts in London. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in London, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, co-working spaces, and corporate headquarters across the City, Canary Wharf, and West End.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'High street stores, shopping centres, and luxury boutiques from Oxford Street to Westfield.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Concerts, conferences, private events, and public gatherings at ExCeL, Wembley, O2 Arena, and more.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Manned guarding, patrols, and access control for building sites across East London, Croydon, and Hounslow.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, restaurants, bars, and nightclubs in Soho, Shoreditch, Mayfair, and South Kensington.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge, patrol, and access control for apartment complexes and gated communities in Chelsea and Hampstead.' },
    ],
    areas: [
      'Westminster', 'City of London', 'Camden', 'Kensington', 'Chelsea', 'Islington',
      'Hackney', 'Tower Hamlets', 'Southwark', 'Lambeth', 'Wandsworth', 'Hammersmith',
      'Greenwich', 'Lewisham', 'Bromley', 'Croydon', 'Brent', 'Ealing', 'Hounslow',
      'Richmond', 'Kingston', 'Merton', 'Sutton', 'Barking', 'Dagenham', 'Havering',
      'Bexley', 'Enfield', 'Haringey', 'Waltham Forest', 'Redbridge', 'Newham', 'Harrow',
      'Barnet', 'Hillingdon',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in London?', answer: "Post your London requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your London security guards fully SIA licensed?', answer: 'Yes. Every security guard on QuickGuard holds a valid SIA licence, and we verify credentials before they can accept jobs. Clients can view licence details on each guard\'s profile before confirming a booking.' },
      { question: 'Which London areas do you cover?', answer: 'We cover all 32 Greater London boroughs including Westminster, City of London, Camden, Kensington & Chelsea, Hackney, Tower Hamlets, Southwark, Lambeth, and extending to outer boroughs like Croydon, Bromley, Barnet, and Hillingdon.' },
      { question: 'What types of security services are available in London?', answer: 'We provide corporate office security, retail loss prevention, event stewards and crowd management, door supervisors for hospitality venues, construction site guarding, residential concierge, CCTV monitoring, and mobile patrols across London.' },
      { question: 'How much does it cost to hire a security guard in London?', answer: 'Hourly rates for London security guards typically range from £12 to £22 per hour depending on the licence type, shift timing, and venue location. Premium central London sites and night shifts may attract higher rates. You set your budget when posting a job.' },
      { question: 'Can I get same-day security coverage in London?', answer: "Post your London requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  manchester: {
    city: 'Manchester',
    slug: 'manchester',
    region: 'Greater Manchester & North West',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Manchester%20commercial%20building%20entrance%20with%20contemporary%20glass%20and%20steel%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20North%20England%20setting%20with%20tram%20and%20modern%20skyline%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Manchester%20architecture%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_manchester_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Manchester",
    tagline: "Find SIA-licensed applicants for security shifts in Manchester. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Manchester, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, co-working spaces, and corporate headquarters in Spinningfields, Deansgate, and Manchester city centre.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Manchester Arndale, Trafford Centre, high street stores, and independent retailers across Greater Manchester.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Old Trafford and Etihad, concerts at AO Arena, and conferences at Manchester Central.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Manned guarding and patrols for major developments in Salford Quays, Ancoats, and Trafford Park.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across Deansgate Locks, Northern Quarter, and Printworks.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge, patrol, and access control for apartment blocks in Castlefield, Ancoats, and MediaCityUK.' },
    ],
    areas: [
      'Manchester City Centre', 'Salford', 'Salford Quays', 'Trafford', 'Trafford Park', 'Stockport',
      'Tameside', 'Oldham', 'Rochdale', 'Bury', 'Bolton', 'Wigan',
      'Spinningfields', 'Deansgate', 'Northern Quarter', 'Ancoats', 'Castlefield', 'MediaCityUK',
      'Whalley Range', 'Chorlton', 'Didsbury', 'Withington', 'Fallowfield', 'Rusholme',
      'Gorton', 'Levenshulme', 'Reddish', 'Denton', 'Hyde', 'Stretford', 'Sale', 'Altrincham',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Manchester?', answer: "Post your Manchester requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Manchester security guards SIA licensed?', answer: 'Yes. Every guard on QuickGuard holds a current SIA licence, and we perform verification checks before guards can accept jobs. SIA licence numbers are visible on guard profiles for client peace of mind.' },
      { question: 'Which Manchester areas do you cover?', answer: 'We cover all ten Greater Manchester boroughs: Manchester, Salford, Trafford, Stockport, Tameside, Oldham, Rochdale, Bury, Bolton, and Wigan. This includes city centre, MediaCityUK, Salford Quays, Trafford Park, and all surrounding suburbs.' },
      { question: 'What security services do you offer in Manchester?', answer: 'Our Manchester services include corporate office guarding, retail loss prevention, event stewarding at stadiums and venues, door supervision for bars and clubs, construction site security, residential concierge and patrol, and mobile security patrols across Greater Manchester.' },
      { question: 'How much does a security guard cost in Manchester?', answer: 'Manchester security guard rates typically range from £11 to £18 per hour depending on the shift type, venue, and licence held. City centre and late-night shifts generally attract a premium. You set your budget when posting a job on QuickGuard.' },
      { question: 'Can I get same-day security guards in Manchester?', answer: "Post your Manchester requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  birmingham: {
    city: 'Birmingham',
    slug: 'birmingham',
    region: 'West Midlands & Birmingham Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Birmingham%20commercial%20building%20entrance%20with%20sleek%20contemporary%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20West%20Midlands%20setting%20with%20modern%20skyline%20and%20canal%20architecture%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Birmingham%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_birmingham_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Birmingham",
    tagline: "Find SIA-licensed applicants for security shifts in Birmingham. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Birmingham, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, business parks, and corporate headquarters in Colmore Row, Brindleyplace, and Edgbaston.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Bullring, Grand Central, Merry Hill, and high street stores across Birmingham and Solihull.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'NEC exhibitions, ICC conferences, Utilita Arena concerts, and stadium events across the West Midlands.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding, access control, and patrols for developments in Digbeth, Perry Barr, and Longbridge.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across Broad Street, Arcadian, and the Jewellery Quarter.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol services for apartment complexes in the city centre, Harborne, and Moseley.' },
    ],
    areas: [
      'Birmingham City Centre', 'Edgbaston', 'Harborne', 'Moseley', 'Kings Heath', 'Selly Oak',
      'Digbeth', 'Aston', 'Erdington', 'Perry Barr', 'Handsworth', 'Small Heath',
      'Sparkbrook', 'Balsall Heath', 'Acocks Green', 'Yardley', 'Sheldon', 'Solihull',
      'Coventry', 'Wolverhampton', 'Dudley', 'Walsall', 'West Bromwich', 'Sutton Coldfield',
      'Redditch', 'Bromsgrove', 'Kidderminster', 'Stourbridge', 'Halesowen', 'Oldbury',
      'Jewellery Quarter', 'Brindleyplace', 'Broad Street', 'Colmore Row', 'Longbridge',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Birmingham?', answer: "Post your Birmingham requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Birmingham security guards fully SIA licensed?', answer: 'Yes. All QuickGuard security professionals hold a valid SIA licence appropriate to their role. We verify every licence before guards can accept jobs, and clients can review licence details directly on guard profiles before booking.' },
      { question: 'Which Birmingham and West Midlands areas do you cover?', answer: 'We cover Birmingham city centre and all surrounding districts including Edgbaston, Harborne, Moseley, Digbeth, Solihull, and extend to Coventry, Wolverhampton, Dudley, Walsall, and the wider West Midlands conurbation.' },
      { question: 'What types of security services are available in Birmingham?', answer: 'Our Birmingham services include corporate office security, retail loss prevention for Bullring and Grand Central, event stewarding at the NEC and Utilita Arena, door supervision for Broad Street venues, construction site guarding, residential concierge, and mobile patrols across the West Midlands.' },
      { question: 'How much does it cost to hire a security guard in Birmingham?', answer: 'Birmingham security guard rates typically range from £10.50 to £17 per hour depending on the specific licence, venue, and shift timing. Premium city centre and late-night positions command higher rates. You control your budget when posting a job.' },
      { question: 'Can I book same-day security guards in Birmingham?', answer: "Post your Birmingham requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  leeds: {
    city: 'Leeds',
    slug: 'leeds',
    region: 'West Yorkshire & Leeds Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Leeds%20commercial%20building%20entrance%20with%20sleek%20contemporary%20Yorkshire%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20northern%20English%20setting%20with%20modern%20glass%20office%20towers%20and%20Victorian%20heritage%20buildings%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Leeds%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_leeds_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Leeds",
    tagline: "Find SIA-licensed applicants for security shifts in Leeds. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Leeds, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, financial sector premises, and corporate headquarters in Leeds city centre and the business district.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Trinity Leeds, Victoria Gate, White Rose Centre, and high street stores across the city centre and suburbs.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Elland Road and Headingley, concerts at First Direct Arena, and conferences across West Yorkshire.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding and access control for major developments in South Leeds, Holbeck, and the South Bank regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, restaurants, and nightclubs across Call Lane, Greek Street, and the Northern Quarter.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol services for apartment complexes and student accommodations in Headingley and the city centre.' },
    ],
    areas: [
      'Leeds City Centre', 'Headingley', 'Chapel Allerton', 'Roundhay', 'Horsforth', 'Kirkstall',
      'Hyde Park', 'Woodhouse', 'Burley', 'Armley', 'Wortley', 'Beeston',
      'Holbeck', 'Hunslet', 'Cross Gates', 'Garforth', 'Morley', 'Batley',
      'Dewsbury', 'Wakefield', 'Bradford', 'Shipley', 'Ilkley', 'Otley',
      'Guiseley', 'Yeadon', 'Pudsey', 'Farsley', 'Rothwell', 'Swillington',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Leeds?', answer: "Post your Leeds requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Leeds security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Leeds holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Leeds areas do you cover?', answer: 'We cover Leeds city centre and all surrounding districts including Headingley, Chapel Allerton, Roundhay, Horsforth, Burley, Hyde Park, Holbeck, Beeston, Cross Gates, and extend to Wakefield, Bradford, and Dewsbury.' },
      { question: 'What security services are available in Leeds?', answer: 'Our Leeds services include corporate office guarding, retail security for Trinity Leeds and Victoria Gate, event stewarding at Elland Road and Headingley, door supervision for city centre venues, construction site guarding, residential concierge, and mobile patrols across West Yorkshire.' },
      { question: 'How much does it cost to hire a security guard in Leeds?', answer: 'Leeds security guard rates typically range from £10.50 to £16 per hour depending on the licence type, venue, and shift timing. City centre and late-night positions may attract a premium. You set your budget when posting a job on QuickGuard.' },
      { question: 'Can I get same-day security guards in Leeds?', answer: "Post your Leeds requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  liverpool: {
    city: 'Liverpool',
    slug: 'liverpool',
    region: 'Merseyside & Liverpool Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Liverpool%20commercial%20building%20entrance%20with%20iconic%20waterfront%20architecture%20and%20contemporary%20glass%20structures%20in%20the%20background%2C%20urban%20Merseyside%20setting%20with%20the%20historic%20docklands%20and%20modern%20city%20skyline%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Liverpool%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_liverpool_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Liverpool",
    tagline: "Find SIA-licensed applicants for security shifts in Liverpool. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Liverpool, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in Liverpool city centre, the business district, and Liverpool Waters.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Liverpool ONE, St Johns Shopping Centre, high street stores, and independent retailers across Merseyside.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Anfield and Goodison Park, concerts at M&S Bank Arena, and the Aintree Race Festival.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in the Baltic Triangle, Liverpool Waters, and Wirral Waters.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, restaurants, and nightclubs across the Ropewalks, Concert Square, and Albert Dock.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in the city centre, Georgian Quarter, and waterfront developments.' },
    ],
    areas: [
      'Liverpool City Centre', 'Ropewalks', 'Georgian Quarter', 'Baltic Triangle', 'Albert Dock', 'Pier Head',
      'Anfield', 'Everton', 'Kirkdale', 'Vauxhall', 'Toxteth', 'Dingle',
      'Wavertree', 'Aigburth', 'Garston', 'Speke', 'Woolton', 'Allerton',
      'Childwall', 'West Derby', 'Croxteth', 'Fazakerley', 'Norris Green', 'Walton',
      'Bootle', 'Crosby', 'Formby', 'Southport', 'Birkenhead', 'Wallasey',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Liverpool?', answer: "Post your Liverpool requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Liverpool security guards SIA licensed?', answer: 'Yes. Every guard on QuickGuard holds a current SIA licence, and we verify all credentials before they can accept jobs. Clients can review licence details on guard profiles before confirming any booking.' },
      { question: 'Which Liverpool and Merseyside areas do you cover?', answer: 'We cover Liverpool city centre, Anfield, Everton, the Baltic Triangle, Albert Dock, and extend to Bootle, Crosby, Southport, Birkenhead, and the Wirral peninsula.' },
      { question: 'What security services are available in Liverpool?', answer: 'Our Liverpool services include corporate office guarding, retail security for Liverpool ONE, event stewarding at Anfield and M&S Bank Arena, door supervision for Concert Square venues, construction site guarding, residential concierge, and mobile patrols across Merseyside.' },
      { question: 'How much does it cost to hire a security guard in Liverpool?', answer: 'Liverpool security guard rates typically range from £10 to £15.50 per hour depending on the licence, venue type, and shift. City centre and match-day events may command higher rates. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Liverpool?', answer: "Post your Liverpool requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  glasgow: {
    city: 'Glasgow',
    slug: 'glasgow',
    region: 'Scotland & Glasgow Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Glasgow%20commercial%20building%20entrance%20with%20striking%20contemporary%20Scottish%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20Scottish%20setting%20with%20modern%20glass%20towers%20and%20historic%20Victorian%20facades%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Glasgow%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_glasgow_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Glasgow",
    tagline: "Find SIA-licensed applicants for security shifts in Glasgow. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Glasgow, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in the IFSD, city centre, and Glasgow business district.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Buchanan Galleries, Silverburn, St Enoch Centre, and high street stores across Glasgow and surrounding areas.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Concerts and exhibitions at the SEC, football events at Ibrox and Celtic Park, and conferences across Greater Glasgow.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in the Gorbals, Glasgow Harbour, and the Clyde waterfront regeneration.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across Ashton Lane, Sauchiehall Street, and the Merchant City.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in the West End, Merchant City, and Glasgow Harbour.' },
    ],
    areas: [
      'Glasgow City Centre', 'Merchant City', 'West End', 'Finnieston', 'Partick', 'Hillhead',
      'Southside', 'Gorbals', 'Govanhill', 'Pollokshields', 'Shawlands', 'Langside',
      'East End', 'Parkhead', 'Shettleston', 'Bridgeton', 'Dennistoun', 'Barmulloch',
      'North Glasgow', 'Maryhill', 'Possilpark', 'Summerston', 'Milton', 'Lambhill',
      'Paisley', 'East Kilbride', 'Cumbernauld', 'Motherwell', 'Hamilton', 'Coatbridge',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Glasgow?', answer: "Post your Glasgow requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Glasgow security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Scotland holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Glasgow areas do you cover?', answer: 'We cover Glasgow city centre, Merchant City, West End, Finnieston, Southside, East End, and extend to Paisley, East Kilbride, Cumbernauld, and the wider Greater Glasgow area.' },
      { question: 'What security services are available in Glasgow?', answer: 'Our Glasgow services include corporate office guarding, retail security for Buchanan Galleries and Silverburn, event stewarding at the SEC and Hampden, door supervision for Ashton Lane and Merchant City venues, construction site guarding, residential concierge, and mobile patrols across Scotland.' },
      { question: 'How much does it cost to hire a security guard in Glasgow?', answer: 'Glasgow security guard rates typically range from £10 to £15 per hour depending on the licence type, venue, and shift. City centre and event shifts may attract a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Glasgow?', answer: "Post your Glasgow requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  edinburgh: {
    city: 'Edinburgh',
    slug: 'edinburgh',
    region: 'Scotland & Edinburgh Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Edinburgh%20commercial%20building%20entrance%20with%20striking%20contemporary%20Scottish%20architecture%20blending%20with%20historic%20stone%20buildings%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20Scottish%20capital%20setting%20with%20modern%20office%20towers%20and%20ancient%20castle%20skyline%20visible%20in%20soft%20focus%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Edinburgh%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_edinburgh_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Edinburgh",
    tagline: "Find SIA-licensed applicants for security shifts in Edinburgh. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Edinburgh, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in the New Town, St Andrew Square, and the Edinburgh Park business district.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'St James Quarter, Princes Street, Ocean Terminal, and high street stores across Edinburgh and the Lothians.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Festival events, concerts at Murrayfield Stadium, and conferences at the EICC and Assembly Rooms.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in Leith, Granton, and the Edinburgh waterfront regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across the Royal Mile, George Street, and Leith Walk.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in the New Town, Stockbridge, and waterfront developments.' },
    ],
    areas: [
      'Edinburgh City Centre', 'New Town', 'Old Town', 'Stockbridge', 'Leith', 'Portobello',
      'Morningside', 'Bruntsfield', 'Marchmont', 'Newington', 'Southside', 'Holyrood',
      'Abbeyhill', 'Pilton', 'Muirhouse', 'Granton', 'Corstorphine', 'Gorgie',
      'Dalry', 'Fountainbridge', 'Slateford', 'Colinton', 'Liberton', 'Craigmillar',
      'Musselburgh', 'Livingston', 'Dunfermline', 'Falkirk', 'Stirling', 'Perth',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Edinburgh?', answer: "Post your Edinburgh requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Edinburgh security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Edinburgh holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile.' },
      { question: 'Which Edinburgh areas do you cover?', answer: 'We cover Edinburgh city centre, New Town, Old Town, Leith, Stockbridge, Morningside, and extend to Livingston, Dunfermline, Stirling, and the wider Lothians and Central Scotland area.' },
      { question: 'What security services are available in Edinburgh?', answer: 'Our Edinburgh services include corporate office guarding, retail security for St James Quarter and Princes Street, event stewarding for the Festival and Murrayfield, door supervision for George Street venues, construction site guarding, residential concierge, and mobile patrols across Scotland.' },
      { question: 'How much does it cost to hire a security guard in Edinburgh?', answer: 'Edinburgh security guard rates typically range from £10 to £15 per hour depending on the licence type, venue, and shift. Festival season and city centre positions may attract a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Edinburgh?', answer: "Post your Edinburgh requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  bristol: {
    city: 'Bristol',
    slug: 'bristol',
    region: 'South West England & Bristol Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Bristol%20commercial%20building%20entrance%20with%20striking%20contemporary%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20South%20West%20England%20setting%20with%20modern%20glass%20office%20towers%20and%20historic%20Clifton%20suspension%20bridge%20visible%20in%20soft%20focus%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Bristol%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_bristol_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Bristol",
    tagline: "Find SIA-licensed applicants for security shifts in Bristol. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Bristol, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in the city centre, Temple Quarter, and Bristol business park areas.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Cabot Circus, Cribbs Causeway, The Galleries, and high street stores across Bristol and Bath.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Ashton Gate, concerts at the harbourside, and festivals across the South West.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in Temple Quarter, South Bristol, and the Bristol Temple Meads regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across the harbourside, Park Street, Whiteladies Road, and Stokes Croft.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in Clifton, Redland, and the city centre harbourside developments.' },
    ],
    areas: [
      'Bristol City Centre', 'Clifton', 'Redland', 'Cotham', 'Montpelier', 'Stokes Croft',
      'Southville', 'Bedminster', 'Totterdown', 'Windmill Hill', 'Knowle', 'Brislington',
      'Easton', 'Eastville', 'Fishponds', 'Staple Hill', 'Kingswood', 'Hanham',
      'Lawrence Hill', 'St Pauls', 'Barton Hill', 'Redcliffe', 'Temple Meads', 'Harbourside',
      'Long Ashton', 'Portishead', 'Clevedon', 'Weston-super-Mare', 'Bath', 'Keynsham',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Bristol?', answer: "Post your Bristol requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Bristol security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Bristol holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Bristol and South West areas do you cover?', answer: 'We cover Bristol city centre, Clifton, Redland, Southville, Temple Quarter, and extend to Bath, Portishead, Weston-super-Mare, and the wider South West region.' },
      { question: 'What security services are available in Bristol?', answer: 'Our Bristol services include corporate office guarding, retail security for Cabot Circus and Cribbs Causeway, event stewarding at Ashton Gate and the harbourside, door supervision for Park Street and Stokes Croft venues, construction site guarding, residential concierge, and mobile patrols across the South West.' },
      { question: 'How much does it cost to hire a security guard in Bristol?', answer: 'Bristol security guard rates typically range from £10 to £15.50 per hour depending on the licence type, venue, and shift. City centre and event shifts may command a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Bristol?', answer: "Post your Bristol requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  cardiff: {
    city: 'Cardiff',
    slug: 'cardiff',
    region: 'Wales & Cardiff Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Cardiff%20commercial%20building%20entrance%20with%20striking%20contemporary%20Welsh%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20Welsh%20capital%20setting%20with%20modern%20glass%20office%20towers%20and%20historic%20castle%20skyline%20visible%20in%20soft%20focus%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Cardiff%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_cardiff_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Cardiff",
    tagline: "Find SIA-licensed applicants for security shifts in Cardiff. Describe your location, hours and requirements, then review applications before you book.",
    description: "Post security requirements in Cardiff, compare applicants and review their SIA licence information before selecting guards. QuickGuard connects clients and security professionals for bookings by the shift. Availability depends on the guards who apply; cover and response times are not guaranteed.",
    stats: [{"label":"Licence information","value":"SIA"},{"label":"Flexible bookings","value":"By shift"},{"label":"Select applicants","value":"Your choice"},{"label":"Payment processing","value":"Stripe"}],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in Cardiff city centre, the Bay, and the Cardiff Gate business park.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: "St David's Dewi Sant, Queens Arcade, Capitol Shopping Centre, and high street stores across Cardiff and Newport." },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at the Principality Stadium and Cardiff City Stadium, concerts, and conferences across South Wales.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in Cardiff Bay, Central Square, and the Cardiff Central regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across St Mary Street, Greyfriars Road, and Cardiff Bay.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in Cardiff Bay, Pontcanna, and the city centre.' },
    ],
    areas: [
      'Cardiff City Centre', 'Cardiff Bay', 'Cathays', 'Roath', 'Pontcanna', 'Canton',
      'Grangetown', 'Butetown', 'Splott', 'Adamsdown', 'Rumney', 'Llanrumney',
      'Pentwyn', 'Llanedeyrn', 'St Mellons', 'Tremorfa', 'Fairwater', 'Ely',
      'Caerau', 'Riverside', 'Heath', 'Birchgrove', 'Whitchurch', 'Rhiwbina',
      'Penarth', 'Barry', 'Newport', 'Caerphilly', 'Pontypridd', 'Bridgend',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Cardiff?', answer: "Post your Cardiff requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
      { question: 'Are your Cardiff security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Wales holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Cardiff and Wales areas do you cover?', answer: 'We cover Cardiff city centre, Cardiff Bay, Cathays, Roath, Pontcanna, and extend to Newport, Penarth, Barry, Caerphilly, and the wider South Wales region.' },
      { question: 'What security services are available in Cardiff?', answer: "Our Cardiff services include corporate office guarding, retail security for St David's and Queens Arcade, event stewarding at the Principality Stadium, door supervision for St Mary Street venues, construction site guarding, residential concierge, and mobile patrols across Wales." },
      { question: 'How much does it cost to hire a security guard in Cardiff?', answer: 'Cardiff security guard rates typically range from £9.50 to £14.50 per hour depending on the licence type, venue, and shift. City centre and stadium event shifts may attract a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Cardiff?', answer: "Post your Cardiff requirement with the correct start time and location. Suitable guards can apply and you choose who to book. Short-notice cover depends on availability; a posting does not guarantee a response time or a confirmed guard." },
    ],

    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(cityData).map((city) => ({ city }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const data = cityData[city.toLowerCase()];
  if (!data) {
    return {
      title: 'Security Guards UK | QuickGuard',
      description: 'Book verified SIA-licensed security guards across the UK.',
    };
  }

  return {
    title: `SIA Security Guards in ${data.city} | QuickGuard`,
    description: `Book verified SIA-licensed security guards in ${data.city} and ${data.region}. Event, retail, corporate, and construction security. Post requirements, compare applicants and review booking fees before payment.`,
    keywords: `security guards ${data.city.toLowerCase()}, SIA licensed ${data.city.toLowerCase()}, hire security ${data.city.toLowerCase()}, event security ${data.city.toLowerCase()}, door supervisor ${data.city.toLowerCase()}, security jobs ${data.city.toLowerCase()}`,
    alternates: {
      canonical: `https://quickguard.uk/security-guards/${data.slug}`,
    },
    openGraph: {
      title: `SIA Security Guards in ${data.city} | QuickGuard`,
      description: `Book verified SIA-licensed security guards in ${data.city}. Event, retail, corporate, and construction security. Post requirements and compare available applicants.`,
      url: `https://quickguard.uk/security-guards/${data.slug}`,
      siteName: 'QuickGuard',
      type: 'website',
      locale: 'en_GB',
      images: [
        {
          url: 'https://public.readdy.ai/ai/img_res/99cbad8f-297d-414a-946f-a43c56ace314.png',
          width: 512,
          height: 512,
          alt: `QuickGuard - Hire SIA Licensed Security Guards in ${data.city}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `SIA Security Guards in ${data.city} | QuickGuard`,
      description: `Book verified SIA-licensed security guards in ${data.city}. Post requirements and compare available applicants.`,
      images: ['https://public.readdy.ai/ai/img_res/99cbad8f-297d-414a-946f-a43c56ace314.png'],
    },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const data = cityData[city.toLowerCase()];
  if (!data) {
    return null;
  }
  return <CityPageClient data={data} />;
}
