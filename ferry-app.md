Yes, this is a good approach:

Customer frontend: Next.js
Admin/backend: Laravel
Database: PostgreSQL or MySQL
However, Laravel should not only be used for the admin area. It should also power the booking API and business logic. Next.js should mainly handle the customer-facing interface.

Recommended architecture
Customer
   ↓
Next.js website
   ↓
Laravel API
   ↓
Database

Admin staff
   ↓
Laravel admin panel
   ↓
Same Laravel API/database
Responsibilities
Next.js customer frontend
Search ferry routes
View schedules
Select passengers
Display prices
Enter passenger information
Start checkout
Display booking confirmation
Show tickets
Support SEO-friendly public pages
Laravel backend
Authentication and permissions
Users and customer accounts
Routes and schedules
Ferry capacity
Temporary booking holds
Booking creation
Payment processing
Payment webhooks
Ticket generation
Cancellations and refunds
Email notifications
Admin operations
Audit logs
Laravel admin panel
View all users
View and manage bookings
Manage ferry routes
Manage schedules
Manage vessels
Manage capacity
Manage prices
View passenger manifests
Check in passengers
Process cancellations and refunds
Manage staff permissions
View reports
Why this works well
1. Separation of responsibilities
Next.js focuses on the customer experience. Laravel focuses on rules, security, and data.

This makes the system easier to maintain than placing booking logic directly in the browser.

2. Better SEO and performance
Next.js is useful for public pages such as:

Ferry routes
Timetables
Prices
Travel information
FAQs
These pages can be server-rendered and indexed by search engines.

3. Strong booking logic
Laravel is well suited for the parts where reliability matters:

Preventing overbooking
Locking available capacity
Handling payment confirmation
Processing refunds
Sending tickets
Managing staff access
The browser should never be trusted to decide whether a booking is valid or whether seats are available.

4. Admin functionality is easier
Laravel has mature tools for:

Authentication
Roles and permissions
Database management
Background jobs
Notifications
Reporting
Admin dashboards
You could build the admin panel using Filament, which would significantly reduce development time.

5. Future flexibility
Later, you could add:

A mobile app
A staff check-in tablet app
A ferry operator portal
A public API
Multiple booking websites
All of them could use the same Laravel backend.

Important recommendation
Do not make the architecture:

Next.js → Database
Instead, use:

Next.js → Laravel API → Database
The Next.js application should not directly access the database. Laravel should validate every booking, price, payment, permission, and availability check.

Suggested technology stack
Customer frontend: Next.js + TypeScript
Backend/API: Laravel + PHP
Admin panel: Laravel + Filament
Database: PostgreSQL
Cache and queues: Redis
Payments: Stripe or suitable local provider
Email: Postmark, Resend, or Mailgun
File storage: S3-compatible storage
Main thing to plan carefully
For a ferry booking system, the most important workflow is:

Customer selects sailing
        ↓
Laravel checks availability
        ↓
Laravel creates temporary booking hold
        ↓
Customer pays
        ↓
Payment provider sends webhook to Laravel
        ↓
Laravel confirms booking
        ↓
Laravel generates ticket
        ↓
Customer receives confirmation
The frontend should display information and collect input, but Laravel should make the final booking decision.

So yes: Next.js for the citizen/customer frontend, Laravel for the backend, booking engine, and admin system is a strong and scalable approach.