// src/data/colleges.js

export const COLLEGES = [
  {
    name: 'College of Accountancy',
    courses: [
      'BS in Accountancy',
      'BS in Accounting Information System',
    ],
  },
  {
    name: 'College of Agriculture',
    courses: [],
  },
  {
    name: 'College of Arts and Sciences',
    courses: [
      'Biology',
      'Economics',
      'Political Science',
      'Psychology',
      'Public Administration',
    ],
  },
  {
    name: 'College of Business Administration',
    courses: [
      'Entrepreneurship',
      'Financial Management',
      'HRD Management',
      'Legal Management',
      'Marketing Management',
      'Real Estate Management',
    ],
  },
  {
    name: 'College of Communication',
    courses: [
      'BA Communication',
      'BA Broadcasting',
      'BA Journalism',
    ],
  },
  {
    name: 'College of Criminology',
    courses: [],
  },
  {
    name: 'College of Engineering and Architecture',
    courses: [
      'Architecture',
      'Astronomy',
      'Civil Engineering',
      'Electrical Engineering',
      'Electronics Engineering',
      'Industrial Engineering',
      'Mechanical Engineering',
    ],
  },
  {
    name: 'College of Education',
    courses: [
      'Bachelor of Early Childhood Education (BECEd)',
      'Bachelor of Elementary Education (BEEd)',
      'Bachelor of Elementary Education in Special Education (Generalist)',
      'Secondary Education - English',
      'Secondary Education - Filipino',
      'Secondary Education - MAPE',
      'Secondary Education - Mathematics',
      'Secondary Education - Science',
      'Secondary Education - Social Studies',
      'Secondary Education - TLE',
    ],
  },
  {
    name: 'College of Informatics and Computing Studies',
    courses: [
      'BS in Computer Science (BSCS)',
      'BS in Entertainment and Multimedia Computing (BSEMC)',
      'BS in Information Systems (BSIS)',
      'BS in Information Technology (BSIT)',
      'Bachelor of Library and Information Science (BLIS)',
    ],
  },
  {
    name: 'College of Medical Technology',
    courses: [],
  },
  {
    name: 'College of Midwifery',
    courses: [],
  },
  {
    name: 'College of Medicine',
    courses: [],
  },
  {
    name: 'College of Law',
    courses: [],
  },
  {
    name: 'College of Music',
    courses: [],
  },
  {
    name: 'College of Nursing',
    courses: [],
  },
  {
    name: 'College of Respiratory Therapy',
    courses: [],
  },
  {
    name: 'College of Foreign Service',
    courses: [],
  },
  {
    name: 'College of Physical Therapy',
    courses: [],
  },
  {
    name: 'School of International Relations',
    courses: [],
  },
  {
    name: 'School of Graduate Studies',
    courses: [],
  },
];

// All courses flat list for dropdowns
export const ALL_COURSES = COLLEGES.flatMap(c => c.courses).filter(Boolean);

// Visit purposes for the library logger
export const VISIT_PURPOSES = [
  'Study / Review',
  'Borrow / Return Books',
  'Research',
  'Use Computer',
  'Group Study',
  'Other',
];

// Filter groups used in the catalog page
export const CATALOG_FILTER_GROUPS = COLLEGES
  .filter(c => c.courses.length > 0)
  .map(c => ({
    group: c.name,
    subjects: c.courses,
  }));
