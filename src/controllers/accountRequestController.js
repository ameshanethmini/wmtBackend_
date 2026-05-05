import * as authService from '../services/authService.js';

export async function getNextEmployeeId(req, res) {
	try {
		const employeeId = await authService.getNextEmployeeId();
		return res.json({ employeeId });
	} catch (err) {
		return res.status(500).json({ error: err.message || 'Unable to generate employee ID' });
	}
}
