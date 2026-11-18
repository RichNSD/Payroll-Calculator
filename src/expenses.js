// Monthly expense totals. Pure functions: no DOM access.

const sum = values => (values || []).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);

/**
 * @param {object} e  expense values (all monthly dollars unless noted)
 * @param {number} e.housingAmount
 * @param {'rent'|'mortgage'} e.housingType
 * @param {number} e.propertyTax          only counted for mortgages
 * @param {number[]} e.housingExtras
 * @param {number} e.utilitiesBase
 * @param {number[]} e.utilitiesExtras
 * @param {object} e.vehicle              { enabled, payment, fuel, insurance, insurancePeriodMonths, extras[] }
 * @param {object} e.publicTransport      { enabled, extras[] }
 * @param {object} e.rideShare            { enabled, extras[] }
 * @param {object} e.miscTravel           { enabled, extras[] }
 * @param {number} e.food
 * @param {number[]} e.additional
 */
export function calculateExpenses(e) {
    const housingTotal = (e.housingAmount || 0)
        + (e.housingType === 'mortgage' ? (e.propertyTax || 0) : 0)
        + sum(e.housingExtras);

    const utilitiesTotal = (e.utilitiesBase || 0) + sum(e.utilitiesExtras);

    const vehicle = e.vehicle || {};
    const insuranceMonthly = vehicle.insurancePeriodMonths > 0
        ? (vehicle.insurance || 0) / vehicle.insurancePeriodMonths
        : (vehicle.insurance || 0);
    const vehicleTotal = vehicle.enabled
        ? (vehicle.payment || 0) + (vehicle.fuel || 0) + insuranceMonthly + sum(vehicle.extras)
        : 0;

    const optional = group => (group?.enabled ? sum(group.extras) : 0);
    const publicTotal = optional(e.publicTransport);
    const rideShareTotal = optional(e.rideShare);
    const miscTravelTotal = optional(e.miscTravel);
    const travelTotal = vehicleTotal + publicTotal + rideShareTotal + miscTravelTotal;

    const foodTotal = e.food || 0;
    const additionalTotal = sum(e.additional);

    return {
        housingTotal,
        utilitiesTotal,
        vehicleTotal,
        publicTotal,
        rideShareTotal,
        miscTravelTotal,
        travelTotal,
        foodTotal,
        additionalTotal,
        total: housingTotal + utilitiesTotal + travelTotal + foodTotal + additionalTotal
    };
}
