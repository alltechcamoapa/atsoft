const url = 'https://jadusmuinpzmmpffybez.supabase.co/rest/v1/proveedores?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZHVzbXVpbnB6bW1wZmZ5YmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODYwMzcsImV4cCI6MjA4NTY2MjAzN30.L7EXSEnoSLfpn4MYeaZholV15WubEeflvM1qyvbqFfM';

fetch(url, {
    headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    }
})
.then(res => {
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return res.json();
})
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
