document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = '/api/doctors/latest';

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (response.ok) {
            updateDashboard(data);
        } else {
            console.error('Failed to fetch doctor data:', data.message);
        }
    } catch (error) {
        console.error('Error connecting to backend:', error);
    }
});

function updateDashboard(doctor) {
    // Update Doctor Name
    const nameElement = document.getElementById('doctor-name-display');
    if (nameElement && doctor.fullName) {
        nameElement.textContent = `Dr. ${doctor.fullName}`;
    } else if (nameElement && doctor.name) {
        nameElement.textContent = `Dr. ${doctor.name}`;
    }

    // You can add more field mappings here based on the actual data structure
    console.log('Loaded doctor data:', doctor);
}
