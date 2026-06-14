// Let's test the database URL parsing logic that we added to BackupService
function testParse(dbUrl: string) {
  let host: string, port: string, user: string, password: string, dbname: string;
  try {
    const parsedUrl = new URL(dbUrl);
    host = parsedUrl.hostname;
    port = parsedUrl.port || '5432';
    user = parsedUrl.username;
    password = decodeURIComponent(parsedUrl.password);
    dbname = parsedUrl.pathname.replace(/^\//, '');
    if (!host || !user || !dbname) {
      throw new Error('Missing database connection fields');
    }
    console.log(`Success parsing: ${dbUrl}`);
    console.log(`  Host:     ${host}`);
    console.log(`  Port:     ${port}`);
    console.log(`  User:     ${user}`);
    console.log(`  Password: ${password}`);
    console.log(`  Dbname:   ${dbname}`);
  } catch (err) {
    console.error(`Failed parsing: ${dbUrl}`);
    console.error(`  Error:    ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log('Testing URL Parsing...');
testParse('postgresql://postgres:password123@localhost:5432/silacod_db');
testParse('postgresql://user_admin:p%40ssw%3Ard@pg.example.com:5433/prod_db?sslmode=require&schema=tenant_1');
testParse('postgresql://root:somepass@myhost/simple_db');
