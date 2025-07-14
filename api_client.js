const BASE_URL = 'http://127.0.0.1:5000/';

/**
 * Função genérica para fazer requisições à API Python.
 * Ela vai automaticamente adicionar o token de autenticação.
 */
async function _request(endpoint, method = 'GET', data = null) {
    const url = BASE_URL + endpoint;
    
    // Pega o token que guardamos no fiado.js
    if (!window.idToken) {
        throw new Error("Usuário não autenticado. Token ausente.");
    }

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.idToken}` // O "crachá" de autenticação
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erro na API: ${response.statusText}`);
        }
        
        if (response.status === 204) { // No Content
            return true;
        }
        return response.json();

    } catch (error) {
        console.error(`Erro na chamada da API para ${endpoint}:`, error);
        throw error; // Propaga o erro para a função que chamou
    }
}

// Criamos um objeto 'apiClient' com métodos para cada endpoint
const apiClient = {
    getCustomers: () => {
        return _request('customers');
    },

    getDebtsByCustomer: (customerId) => {
        return _request(`customers/${customerId}/debts`);
    },

    getPaymentsByCustomer: (customerId) => {
        // Este endpoint precisa existir no seu app.py
        return _request(`customers/${customerId}/payments`);
    },

    registerPayment: (customerId, amount, method, date) => {
        const paymentData = { amount, method, date };
        // Este endpoint também precisa existir no seu app.py
        return _request(`customers/${customerId}/pay-total`, 'POST', paymentData);
    }
};