// src/data/tutorialContent.js
// Each key matches a route/page identifier.
// Content is shown in the floating tutorial tooltip on that page.

const TUTORIAL_CONTENT = {
  dashboard: {
    title: 'Dashboard',
    icon: '📊',
    purpose: 'This is your command center. It gives you a real-time snapshot of library activity — active visitors, recent check-ins, and system status at a glance.',
    howItWorks: 'The dashboard auto-refreshes with live data from Firestore. Cards show today\'s visitor count, currently checked-in users, and quick stats. Admin dashboards also show pending tasks like edit requests.',
    scenario: 'Every morning, open the Dashboard first to see how many visitors are currently in the library and whether any pending actions need your attention.',
    instructions: [
      'Review the live visitor count and active sessions.',
      'Check for any pending edit requests or notifications.',
      'Use the quick-action buttons to navigate to common tasks.',
    ],
  },

  logger: {
    title: 'Library Logger',
    icon: '📋',
    purpose: 'This page shows every visitor check-in and check-out in real time. Think of it as the digital version of the sign-in sheet at the library entrance.',
    howItWorks: 'Each row is a logger entry with the visitor\'s name, ID, purpose, entry time, and exit time. Active sessions (still checked in) appear highlighted. You can force-checkout users who forgot to log out.',
    scenario: 'At closing time, check this page for any visitors still marked as "active." Force-checkout anyone who left without scanning out so the records stay clean.',
    instructions: [
      'Active sessions appear at the top with a green indicator.',
      'Click on any row to see full visitor details.',
      'Use "Force Checkout" for visitors who left without logging out.',
      'Filter by date, status, or search by name/ID.',
    ],
  },

  'staff/kiosk': {
    title: 'Visitor Kiosk (Staff-Operated)',
    icon: '🖥️',
    purpose: 'This is the counter kiosk that staff operate on a shared screen. Visitors approach the desk and staff checks them in or out by typing their ID number or scanning their QR.',
    howItWorks: 'Type a visitor\'s student ID, scan their QR code, or search by email. The system finds their account and either checks them in (if not active) or checks them out (if already active). Identity details are frozen at check-in time.',
    scenario: 'A student walks up to the library counter. Ask for their ID number, type it in, select a purpose, and hit "Check In." When they leave, the same process checks them out automatically.',
    instructions: [
      'Enter the student\'s ID number in the search field.',
      'If found, their name and details appear for confirmation.',
      'Select a visit purpose (Study, Research, Return Book, etc.).',
      'Click Check In or Check Out depending on their current status.',
    ],
  },

  'admin/users': {
    title: 'User Management',
    icon: '👥',
    purpose: 'Manage all registered library users — students, staff, and admins. You can view profiles, change roles, pre-invite new staff via email, and handle account issues.',
    howItWorks: 'The user list loads from Firestore in real time. You can filter by role, search by name/email/ID, and click any user to view or edit their profile. Role changes are logged in the admin audit trail.',
    scenario: 'The head librarian asks you to give a new employee staff access. Search for their email, click their profile, and change their role from "visitor" to "staff." They\'ll see staff features on their next login.',
    instructions: [
      'Search users by name, email, or student ID.',
      'Filter the list by role (Admin, Staff, Visitor).',
      'Click a user to view/edit their profile or change their role.',
      'Use "Invite Staff" to pre-create accounts for new hires.',
      'IT Support accounts (marked with a shield) cannot be demoted.',
    ],
  },

  'admin/edit-requests': {
    title: 'Edit Requests',
    icon: '✏️',
    purpose: 'When visitors want to update their profile info (name, ID, course), they submit an edit request. This page lets you review and approve or reject those requests.',
    howItWorks: 'Pending requests appear in a queue. Each request shows what the visitor wants to change (old value → new value). Approving a request updates the visitor\'s profile in Firestore automatically.',
    scenario: 'A student changed courses and submitted an edit request to update their course info. Review the request, verify it looks correct, and click "Approve" to update their profile instantly.',
    instructions: [
      'Pending requests appear at the top sorted by date.',
      'Review the requested changes carefully before approving.',
      'Approved changes are applied to the user\'s profile immediately.',
      'Rejected requests can include a reason for the visitor to see.',
    ],
  },

  'admin/reports': {
    title: 'Reports',
    icon: '📈',
    purpose: 'Generate and view analytics about library usage — daily visitor counts, peak hours, purpose breakdowns, and more. Export data for presentations or official reports.',
    howItWorks: 'Reports pull from the logger collection and aggregate data by date, time, purpose, and college. Charts visualize trends over time. You can filter by date range and export to CSV.',
    scenario: 'The library director needs monthly visitor statistics for a board meeting. Open Reports, set the date range to last month, and export the visitor summary as a CSV file.',
    instructions: [
      'Select a date range using the date picker.',
      'View charts for visitor trends, peak hours, and purpose distribution.',
      'Export data using the CSV download button.',
      'Toggle between different chart views (daily, weekly, monthly).',
    ],
  },

  'visitor-kiosk': {
    title: 'Visitor Self-Service Kiosk',
    icon: '📱',
    purpose: 'This is the self-service screen visitors see after logging in. They can check themselves in/out of the library, view their visit history, and submit profile edit requests.',
    howItWorks: 'After signing in with their NEU Google account, visitors see their QR code (for staff scanning) and can tap "Check In" to log their visit. The timer shows how long they\'ve been checked in.',
    scenario: 'A student arrives at the library, opens the kiosk on their phone, taps "Check In" and selects "Study" as their purpose. When leaving, they tap "Check Out" and their visit duration is recorded.',
    instructions: [
      'Show your QR code to staff, or tap "Check In" yourself.',
      'Select your purpose of visit from the dropdown.',
      'Your visit timer starts automatically after check-in.',
      'Tap "Check Out" when leaving to record your visit duration.',
    ],
  },

  'qr-logger': {
    title: 'QR Scanner Logger',
    icon: '📷',
    purpose: 'Use the device camera to scan visitor QR codes for quick check-in and check-out. Faster than typing ID numbers for high-traffic periods.',
    howItWorks: 'The page activates the device camera and continuously scans for QR codes. When a valid code is detected, the system instantly looks up the visitor and toggles their check-in status.',
    scenario: 'During a rush hour, open the QR Logger on a tablet at the entrance. Visitors flash their phone QR codes as they walk in, and the system auto-checks them in without any typing.',
    instructions: [
      'Allow camera access when prompted.',
      'Hold the QR code steady in front of the camera.',
      'The system auto-detects and processes the code.',
      'A confirmation appears showing check-in or check-out status.',
    ],
  },

  'student-records': {
    title: 'Student Records',
    icon: '📁',
    purpose: 'Look up any registered visitor\'s complete library history — all their past check-ins, visit durations, and purposes. Useful for verifying visit logs or investigating discrepancies.',
    howItWorks: 'Search by name, ID number, or email to find a student. Their profile and complete visit history loads from Firestore, sorted by most recent. You can see every entry and exit timestamp.',
    scenario: 'A student claims they were in the library last Tuesday but their professor says they weren\'t. Search the student\'s ID here to verify their exact check-in and check-out times.',
    instructions: [
      'Search for a student by name, ID number, or email.',
      'View their complete visit history with timestamps.',
      'Check active sessions to see if they\'re currently in the library.',
      'Use this to verify visit claims or attendance disputes.',
    ],
  },

  catalog: {
    title: 'Book Catalog',
    icon: '📚',
    purpose: 'Browse, search, and manage the library\'s book collection. Add new books, edit existing entries, track availability, and manage the lending inventory.',
    howItWorks: 'Books are stored in Firestore with details like title, author, ISBN, category, and available copies. The catalog supports search, filtering by category, and batch operations for inventory management.',
    scenario: 'New textbooks arrive for the semester. Open the Catalog, click "Add Book," fill in the details (title, author, ISBN, copies), and the book becomes immediately available for borrowing.',
    instructions: [
      'Search books by title, author, or ISBN.',
      'Filter by category or availability status.',
      'Click "Add Book" to register new inventory.',
      'Edit existing books to update copies or details.',
    ],
  },

  // ── Staff/Admin: Borrowing Management ────────────────────────────────────
  'borrowing-staff': {
    title: 'Borrowing Management',
    icon: '📖',
    purpose: 'Track all book borrowing transactions — who borrowed what, when it\'s due, and overdue items. Process checkouts and returns from this page.',
    howItWorks: 'Each borrow record links a user to a book with dates. The system tracks status (active, returned, overdue) and can send overdue notifications. Staff can process returns and extend due dates.',
    scenario: 'A student brings back a book. Search their name or the book title, find the active borrow record, and click "Return" to mark it as returned and update the available copies.',
    instructions: [
      'View all active borrows sorted by due date.',
      'Process returns by finding the borrow record and marking it returned.',
      'Overdue items are highlighted in red with days overdue.',
      'Use the Remind button on overdue entries to notify the student.',
    ],
  },

  // ── Student-facing pages ──────────────────────────────────────────────────

  'visitor-kiosk': {
    title: 'Visitor Self-Service Kiosk',
    icon: '📱',
    purpose: 'This is your personal library check-in screen. Use it to log your visit, track how long you\'ve been in the library, and manage your library session.',
    howItWorks: 'Tap "Check In" when you arrive and select your reason for visiting. The timer starts automatically. When you leave, tap "Check Out" so your visit is properly recorded.',
    scenario: 'You arrive at the library to study for an exam. Open the kiosk, tap "Check In," select "Study," and your session begins. When you\'re done, tap "Check Out" before you leave.',
    instructions: [
      'Tap "Check In" when you arrive at the library.',
      'Select your purpose of visit (Study, Research, Return Book, etc.).',
      'Your visit timer starts automatically — you can see how long you\'ve been here.',
      'Tap "Check Out" when you\'re leaving so your visit is logged correctly.',
      'Show your QR code to staff at the counter for faster check-in.',
    ],
  },

  'student-dashboard': {
    title: 'Your Dashboard',
    icon: '🏠',
    purpose: 'This is your personal library home screen. See your active borrows, overdue books, pending requests, and your current library session at a glance.',
    howItWorks: 'The dashboard updates in real time. Your borrow stats are shown at the top, your QR code is available for staff scanning, and you can see whether you\'re currently checked in to the library.',
    scenario: 'Before heading to the library, check your dashboard to see if any books are overdue and how many you still have borrowed. This helps you plan what to return.',
    instructions: [
      'Check the stat cards at the top for your borrow activity.',
      'Your library QR code is always available — show it to staff for quick check-in.',
      'If you have overdue books, they\'ll be highlighted in red — return them soon!',
      'Use "View All" under Recent Borrows to see your full borrowing history.',
    ],
  },

  catalog: {
    title: 'Book Catalog',
    icon: '📚',
    purpose: 'Browse the library\'s full book collection. Search by title, author, or ISBN, and request to borrow any available book.',
    howItWorks: 'Search or browse the catalog to find books. Each listing shows availability — how many copies are in stock. If copies are available, you can submit a borrow request which staff will approve.',
    scenario: 'You need a specific textbook for your class. Search its title in the catalog, check that copies are available, and click "Request Borrow." Staff will process it within the day.',
    instructions: [
      'Use the search bar to find books by title, author, or ISBN.',
      'Filter by category to browse books in your field.',
      'Green number = copies available. Red = all copies are out.',
      'Click "Request Borrow" to submit a borrow request.',
      'Check "My Borrows" to track the status of your request.',
    ],
  },

  borrowing: {
    title: 'My Borrows',
    icon: '📖',
    purpose: 'Track all your borrowed books — active loans, pending requests, returned books, and overdue items. Manage your borrowing history from here.',
    howItWorks: 'Your borrow requests appear as "Pending" until staff approves them. Once approved, they become "Active." Return books at the library counter and staff will mark them returned here.',
    scenario: 'You submitted a borrow request yesterday. Open My Borrows to check if it\'s been approved. Once approved, visit the library counter to collect your book.',
    instructions: [
      'Pending tab — borrow requests waiting for staff approval.',
      'Active tab — books you currently have borrowed.',
      'Overdue tab — books past their due date (return these immediately!).',
      'Returned tab — your full borrowing history.',
      'Note: You cannot borrow new books if you have overdue items.',
    ],
  },

export default TUTORIAL_CONTENT;
