const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7InVzZXJwayI6IjZmY2ZhZDYwLTA2NmMtMTFlZS04ODZlLWZmNzJjNjFmZWUyYyIsImxvY3BrIjoiMDBhMThmYzAtMDUxZC0xMWVhLThlMzUtYWJhNDkyZDhjYjY1IiwiZGVwdHBrIjoiNjg4MjcwNjAtMDUyMS0xMWVhLThlMzUtYWJhNDkyZDhjYjY4In0sImlhdCI6MTc0ODIxOTIxNiwiZXhwIjoxNzQ4MjYyNDE2fQ.3xVEFIAxXijsjvRfi9vDzhjByekr-YbXibigXl2LA-4';

axios.post('http://gsuite.graphicstar.com.ph/api/get_transaction', {}, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('✅ Response:', response.data);
})
.catch(error => {
  console.error('❌ Error:', error.response?.data || error.message);
});
