// Who can open the admin dashboard and read every customer's data. The database's is_admin()
// function (supabase/migrations/20261023_admin_emails.sql) keeps the same list; change both.
export const ADMIN_EMAILS = ['admin@dinnerwithcharles.com', 'rodonnell6891@gmail.com', 'odonnellandreab@gmail.com']

export const isAdminEmail = (email) => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase())
