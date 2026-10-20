/**
 * mock-endpoint-runner - Faker / Fixture Data Generator
 * Zero-dependency realistic fake data generator with optional deterministic seeding.
 */

// Simple seeded pseudo-random number generator (Mulberry32)
function createRandom(seedValue) {
  if (typeof seedValue !== 'number') {
    return Math.random;
  }
  let s = seedValue >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let currentRandom = Math.random;

export function seed(val) {
  currentRandom = createRandom(val);
}

export function resetSeed() {
  currentRandom = Math.random;
}

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Sam', 'Chris', 'Pat', 'Riley', 'Avery',
  'Logan', 'Dakota', 'Cameron', 'Reese', 'Quinn', 'Harper', 'Rowan', 'Finley', 'Skyler', 'Emerson',
  'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Ava', 'Elijah', 'Charlotte', 'William', 'Sophia',
  'James', 'Amelia', 'Benjamin', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Evelyn', 'Alexander', 'Harper'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
];

const DOMAINS = ['example.com', 'testmail.org', 'devnull.io', 'mockapi.dev', 'webmail.test'];

const CITIES = [
  'San Francisco', 'New York', 'London', 'Berlin', 'Tokyo', 'Toronto', 'Sydney', 'Paris', 'Amsterdam', 'Singapore',
  'Austin', 'Seattle', 'Chicago', 'Denver', 'Dublin', 'Stockholm', 'Seoul', 'Boston', 'Vancouver', 'Zurich'
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'Canada', 'Australia', 'France', 'Japan', 'Netherlands', 'Sweden', 'Switzerland'
];

const STREET_NAMES = ['Oak', 'Maple', 'Pine', 'Cedar', 'Elm', 'Washington', 'Lake', 'Hill', 'Market', 'Broadway'];
const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Rd', 'Ln', 'Way', 'Dr'];

const COMPANIES = [
  'Acme Corp', 'Globex Systems', 'Initech Solutions', 'Umbrella Tech', 'Stark Innovations',
  'Hooli Digital', 'Pied Piper', 'Cyberdyne Data', 'Wayne Enterprises', 'Soylent Cloud',
  'Massive Dynamic', 'Oscorp Labs', 'Wonka Logistics', 'Dunder Mifflin', 'Vandelay Industries'
];

const JOB_TITLES = [
  'Senior Software Engineer', 'Product Manager', 'UX Designer', 'DevOps Specialist', 'Data Scientist',
  'QA Automation Engineer', 'Frontend Architect', 'Full Stack Developer', 'Engineering Manager', 'Security Analyst'
];

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'curabitur', 'vel',
  'hendrerit', 'libero', 'eleifend', 'blandit', 'nunc', 'ornare', 'odio', 'ut', 'orci', 'gravida',
  'imperdiet', 'nullam', 'purus', 'lacinia', 'a', 'pretium', 'quis', 'congue', 'praesent', 'sagittis',
  'laoreet', 'auctor', 'mauris', 'non', 'velit', 'eros', 'dictum', 'proin', 'accumsan', 'sapien'
];

const PRODUCT_ADJECTIVES = ['Sleek', 'Ergonomic', 'Wireless', 'Ultra', 'Smart', 'Eco-Friendly', 'Portable', 'Pro', 'Compact', 'Heavy-Duty'];
const PRODUCT_CATEGORIES = ['Headphones', 'Keyboard', 'Monitor', 'Smartwatch', 'Speaker', 'Desk Lamp', 'Backpack', 'Charger', 'Microphone', 'Webcam'];

function rand() {
  return currentRandom();
}

export function oneOf(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(rand() * arr.length)];
}

export function integer(min = 1, max = 100) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function float(min = 0, max = 100, decimals = 2) {
  const num = rand() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

export function boolean(chance = 0.5) {
  return rand() < chance;
}

export function uuid() {
  // RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (rand() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function id(prefix = 'id_') {
  return `${prefix}${Math.random().toString(36).substring(2, 9)}${Math.floor(rand() * 1000)}`;
}

export function firstName() {
  return oneOf(FIRST_NAMES);
}

export function lastName() {
  return oneOf(LAST_NAMES);
}

export function name() {
  return `${firstName()} ${lastName()}`;
}

export function email(customName) {
  let base;
  if (customName && typeof customName === 'string') {
    base = customName.toLowerCase().replace(/[^a-z0-9]/g, '.');
  } else {
    base = `${firstName().toLowerCase()}.${lastName().toLowerCase()}`;
  }
  return `${base}${integer(1, 99)}@${oneOf(DOMAINS)}`;
}

export function username(customName) {
  const base = customName ? customName.toLowerCase().replace(/[^a-z0-9]/g, '') : firstName().toLowerCase();
  return `${base}_${integer(10, 999)}`;
}

export function avatar(seedStr) {
  const idStr = seedStr || integer(1, 1000);
  return `https://i.pravatar.cc/150?u=${idStr}`;
}

export function phone() {
  return `+1-${integer(200, 999)}-${integer(100, 999)}-${integer(1000, 9999)}`;
}

export function city() {
  return oneOf(CITIES);
}

export function country() {
  return oneOf(COUNTRIES);
}

export function zipCode() {
  return `${integer(10000, 99999)}`;
}

export function streetAddress() {
  return `${integer(10, 9999)} ${oneOf(STREET_NAMES)} ${oneOf(STREET_TYPES)}`;
}

export function address() {
  return {
    street: streetAddress(),
    city: city(),
    country: country(),
    zipCode: zipCode(),
  };
}

export function company() {
  return oneOf(COMPANIES);
}

export function jobTitle() {
  return oneOf(JOB_TITLES);
}

export function word() {
  return oneOf(LOREM_WORDS);
}

export function words(count = 3) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push(word());
  }
  return list.join(' ');
}

export function sentence(minWords = 5, maxWords = 12) {
  const count = integer(minWords, maxWords);
  const w = [];
  for (let i = 0; i < count; i++) {
    w.push(word());
  }
  const s = w.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

export function paragraph(minSentences = 3, maxSentences = 6) {
  const count = integer(minSentences, maxSentences);
  const sentences = [];
  for (let i = 0; i < count; i++) {
    sentences.push(sentence());
  }
  return sentences.join(' ');
}

export function date(daysBack = 365) {
  const now = Date.now();
  const past = now - integer(0, daysBack * 86400000);
  return new Date(past).toISOString();
}

export function futureDate(daysAhead = 365) {
  const now = Date.now();
  const future = now + integer(1, daysAhead * 86400000);
  return new Date(future).toISOString();
}

export function timestamp() {
  return Date.now();
}

export function product() {
  const adj = oneOf(PRODUCT_ADJECTIVES);
  const cat = oneOf(PRODUCT_CATEGORIES);
  return {
    id: uuid(),
    name: `${adj} ${cat}`,
    category: cat,
    price: float(9.99, 499.99, 2),
    rating: float(3.0, 5.0, 1),
    inStock: boolean(0.85),
    sku: `SKU-${integer(1000, 9999)}-${word().toUpperCase().slice(0, 3)}`,
    description: sentence(6, 15),
    createdAt: date(180)
  };
}

export function user() {
  const fn = firstName();
  const ln = lastName();
  const fullName = `${fn} ${ln}`;
  return {
    id: uuid(),
    name: fullName,
    username: `${fn.toLowerCase()}_${integer(10, 99)}`,
    email: email(fullName),
    avatar: avatar(fullName),
    phone: phone(),
    role: oneOf(['admin', 'member', 'viewer', 'editor']),
    active: boolean(0.9),
    company: company(),
    title: jobTitle(),
    address: address(),
    createdAt: date(365)
  };
}

export function post() {
  return {
    id: uuid(),
    title: sentence(4, 9).replace(/\.$/, ''),
    slug: words(3).replace(/\s+/g, '-'),
    body: paragraph(2, 5),
    authorId: uuid(),
    views: integer(10, 5000),
    likes: integer(0, 500),
    tags: [word(), word(), word()],
    published: boolean(0.8),
    createdAt: date(60)
  };
}

export function order() {
  const itemCount = integer(1, 4);
  const items = [];
  let total = 0;
  for (let i = 0; i < itemCount; i++) {
    const p = product();
    const qty = integer(1, 3);
    const lineTotal = Number((p.price * qty).toFixed(2));
    total += lineTotal;
    items.push({
      productId: p.id,
      name: p.name,
      unitPrice: p.price,
      quantity: qty,
      subtotal: lineTotal
    });
  }
  return {
    id: `ord_${integer(10000, 99999)}`,
    orderNumber: `ORD-${Date.now().toString().slice(-6)}-${integer(100, 999)}`,
    customerId: uuid(),
    status: oneOf(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
    items,
    total: Number(total.toFixed(2)),
    currency: 'USD',
    shippingAddress: address(),
    createdAt: date(30)
  };
}

export function array(generatorFn, count = 5) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(typeof generatorFn === 'function' ? generatorFn(i) : generatorFn);
  }
  return result;
}

export const faker = {
  seed,
  resetSeed,
  oneOf,
  integer,
  float,
  boolean,
  uuid,
  id,
  firstName,
  lastName,
  name,
  email,
  username,
  avatar,
  phone,
  city,
  country,
  zipCode,
  streetAddress,
  address,
  company,
  jobTitle,
  word,
  words,
  sentence,
  paragraph,
  date,
  futureDate,
  timestamp,
  product,
  user,
  post,
  order,
  array
};

export default faker;
