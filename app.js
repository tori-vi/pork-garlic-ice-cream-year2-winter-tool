/* Calculation logic is deliberately independent of rendering so the rules can be checked and extended. */
const STORAGE_KEY = "pork-garlic-year2-winter-v1";
const shekels = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const number = (value) => (value === "" || value === null || value === undefined || Number.isNaN(Number(value)) ? 0 : Number(value));
const whole = (value) => Math.round(number(value));
const money = (value) => `Sh ${shekels.format(whole(value))}`;
const signedMoney = (value) => `${whole(value) < 0 ? "−" : ""}Sh ${shekels.format(Math.abs(whole(value)))}`;
const units = (value) => `${shekels.format(whole(value))} units`;
const percent = (value) => `${number(value).toFixed(number(value) % 1 ? 1 : 0)}%`;
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

const initialState = {
  company: {
    openingCash: "",
    annualProfit: "",
    taxLossPool: "",
    machinesConfirmed: false,
    loansConfirmed: false,
    ownedMachines: [{ name: "", capacity: "", maintenance: "", depreciation: "", remainingLife: "" }],
    existingLoans: [{ name: "", debt: "", principalDue: "", interestRate: "" }],
  },
  assumptions: {
    sellingPrice: 2,
    fixedSalaries: 10000,
    bonusRate: 5,
    taxRate: 10,
  },
  options: [
    {
      name: "Option A — cash-first",
      selectedScenario: "base",
      plannedProduction: 40000,
      milkTonnes: 2,
      milkPrice: 20000,
      milkYield: 20000,
      salesRequest: 40000,
      marketInvestment: 3000,
      machineCapacityUsed: 72000,
      machineSlotsUsed: 1,
      newMachinePrice: 0,
      newMachineCapacity: 0,
      newMachineMaintenance: 0,
      newMachineLife: 8,
      newMachineSlots: 1,
      newBorrowing: 0,
      newLoanTerm: 8,
      newLoanInterestRate: 10,
      scenarios: { low: 20000, base: 25000, high: 35000 },
      premises: [{ name: "Premise D (estimate)", active: true, slots: 1, rent: 17000, transport: 0.1, production: 40000 }],
    },
    {
      name: "Option B — demand-led",
      selectedScenario: "base",
      plannedProduction: 70000,
      milkTonnes: 3.5,
      milkPrice: 20000,
      milkYield: 20000,
      salesRequest: 70000,
      marketInvestment: 6000,
      machineCapacityUsed: 72000,
      machineSlotsUsed: 1,
      newMachinePrice: 0,
      newMachineCapacity: 0,
      newMachineMaintenance: 0,
      newMachineLife: 8,
      newMachineSlots: 1,
      newBorrowing: 0,
      newLoanTerm: 8,
      newLoanInterestRate: 10,
      scenarios: { low: 20000, base: 40000, high: 60000 },
      premises: [{ name: "Premise D (estimate)", active: true, slots: 1, rent: 17000, transport: 0.1, production: 70000 }],
    },
  ],
};

let state = loadState();

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (_) { /* Browser storage can be unavailable in private sessions. */ }
  return clone(initialState);
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Keep calculator working without storage. */ }
}
function getPath(path) { return path.split(".").reduce((value, key) => value?.[key], state); }
function setPath(path, value) {
  const keys = path.split(".");
  let target = state;
  keys.slice(0, -1).forEach((key) => { target = target[key]; });
  target[keys.at(-1)] = value;
}

function isFilled(value) { return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)); }
function companyIsComplete(company) {
  return isFilled(company.openingCash)
    && isFilled(company.annualProfit)
    && isFilled(company.taxLossPool)
    && company.machinesConfirmed
    && company.loansConfirmed;
}

function allocateSales(actualSales, premises) {
  const producers = premises.filter((premise) => premise.active && number(premise.production) > 0);
  const totalProduced = producers.reduce((sum, premise) => sum + number(premise.production), 0);
  if (!producers.length || totalProduced <= 0) return [];
  let assigned = 0;
  return producers.map((premise, index) => {
    const sale = index === producers.length - 1
      ? whole(actualSales - assigned)
      : whole(actualSales * number(premise.production) / totalProduced);
    assigned += sale;
    return { ...premise, allocatedSales: sale, transportCost: whole(sale * number(premise.transport)) };
  });
}

function calculate(company, assumptions, option, rawSales) {
  const warnings = [];
  const ownedMachines = company.ownedMachines.filter((machine) => isFilled(machine.capacity) || isFilled(machine.maintenance) || isFilled(machine.depreciation));
  const existingLoans = company.existingLoans.filter((loan) => isFilled(loan.debt) || isFilled(loan.principalDue) || isFilled(loan.interestRate));
  const activePremises = option.premises.filter((premise) => premise.active);
  const existingCapacity = number(option.machineCapacityUsed);
  const newMachineBought = number(option.newMachinePrice) > 0;
  const newMachineCapacity = newMachineBought ? number(option.newMachineCapacity) : 0;
  const totalMachineCapacity = existingCapacity + newMachineCapacity;
  const totalMilkUnits = number(option.milkTonnes) * number(option.milkYield);
  const requestedProduction = number(option.plannedProduction);
  const production = whole(Math.max(0, Math.min(requestedProduction, totalMachineCapacity, totalMilkUnits)));
  const salesRequest = Math.max(0, number(option.salesRequest));
  const rawAllocation = Math.max(0, number(rawSales));
  const actualSales = whole(Math.min(rawAllocation, production, salesRequest));
  const premiseProduction = activePremises.reduce((sum, premise) => sum + number(premise.production), 0);
  const slotCapacity = activePremises.reduce((sum, premise) => sum + number(premise.slots), 0);
  const slotsRequired = number(option.machineSlotsUsed) + (newMachineBought ? number(option.newMachineSlots) : 0);

  if (requestedProduction > totalMachineCapacity) warnings.push(`Planned production is ${units(requestedProduction - totalMachineCapacity)} above declared machine capacity.`);
  if (requestedProduction > totalMilkUnits) warnings.push(`Planned production is ${units(requestedProduction - totalMilkUnits)} above milk available.`);
  if (rawAllocation > production || rawAllocation > salesRequest) warnings.push("Entered allocated sales exceed production or request; the calculation caps them at the feasible amount.");
  if (production > 0 && !activePremises.length) warnings.push("Choose at least one active premise for the planned production.");
  if (production > 0 && whole(premiseProduction) !== production) warnings.push("Production by active premises does not equal planned feasible production; transport allocation uses the premise proportions shown.");
  if (slotsRequired > slotCapacity) warnings.push(`Machine slots required (${slotsRequired}) exceed selected premise slots (${slotCapacity}).`);
  if (newMachineBought && number(option.newMachineLife) <= 0) warnings.push("New machine useful life must be greater than zero to calculate depreciation.");
  if (number(option.newBorrowing) > 0 && number(option.newLoanTerm) <= 0) warnings.push("New loan term must be greater than zero to calculate the first principal repayment.");

  const allocatedPremises = allocateSales(actualSales, activePremises);
  const milkCost = whole(number(option.milkTonnes) * number(option.milkPrice));
  const existingMaintenance = whole(ownedMachines.reduce((sum, machine) => sum + number(machine.maintenance), 0));
  const existingDepreciation = whole(ownedMachines.reduce((sum, machine) => sum + (number(machine.remainingLife) > 0 ? number(machine.depreciation) : 0), 0));
  const newMachineDepreciation = newMachineBought && number(option.newMachineLife) > 0
    ? whole(number(option.newMachinePrice) / number(option.newMachineLife)) : 0;
  const maintenance = whole(existingMaintenance + (newMachineBought ? number(option.newMachineMaintenance) : 0));
  const depreciation = whole(existingDepreciation + newMachineDepreciation);
  const revenue = whole(actualSales * number(assumptions.sellingPrice));
  const grossProfit = whole(revenue - milkCost - maintenance - depreciation);
  const bonus = grossProfit > 0 ? whole(grossProfit * number(assumptions.bonusRate) / 100) : 0;
  const transport = whole(allocatedPremises.reduce((sum, premise) => sum + premise.transportCost, 0));
  const rent = whole(activePremises.reduce((sum, premise) => sum + number(premise.rent), 0));
  const existingInterest = whole(existingLoans.reduce((sum, loan) => sum + number(loan.debt) * number(loan.interestRate) / 100, 0));
  const newInterest = number(option.newBorrowing) > 0 ? whole(number(option.newBorrowing) * number(option.newLoanInterestRate) / 100) : 0;
  const interest = whole(existingInterest + newInterest);
  const pbt = whole(grossProfit - transport - number(option.marketInvestment) - bonus - number(assumptions.fixedSalaries) - rent - interest);
  const lossPoolStart = Math.max(0, number(company.taxLossPool));
  const lossPoolUsed = pbt > 0 ? whole(Math.min(pbt, lossPoolStart)) : 0;
  const taxableProfit = whole(Math.max(0, pbt - lossPoolUsed));
  const tax = whole(taxableProfit * number(assumptions.taxRate) / 100);
  const netProfit = whole(pbt - tax);
  const taxLossPoolEnd = pbt < 0 ? whole(lossPoolStart + Math.abs(pbt)) : whole(lossPoolStart - lossPoolUsed);
  const existingPrincipal = whole(existingLoans.reduce((sum, loan) => sum + Math.min(number(loan.debt), number(loan.principalDue)), 0));
  const newPrincipal = number(option.newBorrowing) > 0 && number(option.newLoanTerm) > 0
    ? whole(number(option.newBorrowing) / number(option.newLoanTerm)) : 0;
  const machinePurchase = whole(number(option.newMachinePrice));
  const cashBeforeMarket = whole(number(company.openingCash) + number(option.newBorrowing) - machinePurchase - milkCost - number(option.marketInvestment));
  const closingCash = whole(number(company.openingCash) + number(option.newBorrowing) + revenue - machinePurchase - milkCost - number(option.marketInvestment) - rent - maintenance - transport - number(assumptions.fixedSalaries) - bonus - existingPrincipal - newPrincipal - interest - tax);
  if (cashBeforeMarket < 0) warnings.push(`Cash before market is negative (${signedMoney(cashBeforeMarket)}).`);
  if (closingCash < 0) warnings.push(`Closing cash is negative (${signedMoney(closingCash)}).`);

  return {
    production, actualSales, rawAllocation, salesRequest, totalMilkUnits: whole(totalMilkUnits), totalMachineCapacity: whole(totalMachineCapacity),
    unusedMilk: whole(Math.max(0, totalMilkUnits - production)), unsoldIceCream: whole(Math.max(0, production - actualSales)),
    allocatedPremises, warnings, slotCapacity, slotsRequired,
    revenue, milkCost, maintenance, depreciation, grossProfit, transport, bonus, rent, interest, pbt,
    lossPoolUsed, taxableProfit, tax, netProfit, taxLossPoolEnd,
    openingCash: whole(company.openingCash), newLoans: whole(option.newBorrowing), machinePurchase, marketInvestment: whole(option.marketInvestment),
    fixedSalaries: whole(assumptions.fixedSalaries), existingPrincipal, newPrincipal, cashBeforeMarket, closingCash,
    existingDebtEnd: whole(existingLoans.reduce((sum, loan) => sum + Math.max(0, number(loan.debt) - Math.min(number(loan.debt), number(loan.principalDue))), 0)),
    newDebtEnd: whole(Math.max(0, number(option.newBorrowing) - newPrincipal)),
    existingMaintenance, existingDepreciation, newMachineDepreciation,
  };
}

function field(label, path, { type = "number", step = "1", required = false, note = "", min = 0 } = {}) {
  const value = getPath(path);
  const classes = `input-group ${required ? "required" : ""}`;
  const input = type === "checkbox"
    ? `<input data-path="${path}" data-kind="checkbox" type="checkbox" ${value ? "checked" : ""} />`
    : `<input data-path="${path}" data-kind="${type}" type="${type}" min="${min}" step="${step}" value="${esc(value)}" />`;
  return `<label class="${classes}"><span>${esc(label)}${required ? " *" : ""}</span>${input}${note ? `<span class="field-note">${note}</span>` : ""}</label>`;
}

function selectedPremiseRows(optionIndex, option) {
  return option.premises.map((premise, premiseIndex) => `
    <div class="premise-row">
      <input data-path="options.${optionIndex}.premises.${premiseIndex}.name" data-kind="text" aria-label="Premise name" value="${esc(premise.name)}" placeholder="Premise name" />
      <label>Use<input data-path="options.${optionIndex}.premises.${premiseIndex}.active" data-kind="checkbox" type="checkbox" ${premise.active ? "checked" : ""} /></label>
      <label>Slots<input data-path="options.${optionIndex}.premises.${premiseIndex}.slots" data-kind="number" type="number" min="0" step="1" value="${esc(premise.slots)}" /></label>
      <label>Rent<input data-path="options.${optionIndex}.premises.${premiseIndex}.rent" data-kind="number" type="number" min="0" step="1" value="${esc(premise.rent)}" /></label>
      <label>Transport / sale<input data-path="options.${optionIndex}.premises.${premiseIndex}.transport" data-kind="number" type="number" min="0" step="0.01" value="${esc(premise.transport)}" /></label>
      <label>Production<input data-path="options.${optionIndex}.premises.${premiseIndex}.production" data-kind="number" type="number" min="0" step="1" value="${esc(premise.production)}" /></label>
      <button class="icon-button" data-action="remove-premise" data-option="${optionIndex}" data-row="${premiseIndex}" type="button" aria-label="Remove premise">×</button>
    </div>`).join("");
}

function statement(label, entries) {
  return `<section class="statement"><h4>${label}</h4><dl>${entries.map(([name, value, total = false]) => `<div class="line ${total ? "total" : ""}"><dt>${name}</dt><dd class="${value < 0 ? "negative" : ""}">${signedMoney(value)}</dd></div>`).join("")}</dl></section>`;
}

function scenarioCards(optionIndex, option, results) {
  return `<div class="scenario-grid">${["low", "base", "high"].map((scenario) => {
    const result = results[scenario];
    const chosen = option.selectedScenario === scenario;
    return `<div class="scenario ${chosen ? "selected" : ""}">
      <label><input data-path="options.${optionIndex}.selectedScenario" data-kind="radio" data-value="${scenario}" type="radio" name="scenario-${optionIndex}" ${chosen ? "checked" : ""} /> ${scenario[0].toUpperCase() + scenario.slice(1)}</label>
      <input data-path="options.${optionIndex}.scenarios.${scenario}" data-kind="number" type="number" min="0" step="1" value="${esc(option.scenarios[scenario])}" aria-label="${scenario} actual sales allocation" />
      <p class="scenario-stats">Used sales: ${units(result.actualSales)}<br>Net: <span class="${result.netProfit < 0 ? "negative" : "positive"}">${signedMoney(result.netProfit)}</span><br>Closing cash: <span class="${result.closingCash < 0 ? "negative" : ""}">${signedMoney(result.closingCash)}</span></p>
    </div>`;
  }).join("")}</div>`;
}

function optionCard(optionIndex, option, result, scenarioResults) {
  const selected = option.selectedScenario;
  const allocated = result.allocatedPremises.length
    ? result.allocatedPremises.map((premise) => `${esc(premise.name || "Unnamed premise")}: ${units(premise.allocatedSales)}, ${money(premise.transportCost)} transport`).join(" · ")
    : "No premise allocation available.";
  return `<article class="card option-card ${optionIndex === 1 ? "b" : "a"}" data-testid="option-${optionIndex === 0 ? "a" : "b"}">
    <div class="option-banner"><div><span class="estimate-label">Year 2 estimate</span><h2>${esc(option.name)}</h2></div><span class="small">Headline: ${selected} scenario</span></div>
    <div class="option-body">
      <section>
        <div class="card-heading"><h3>Plan inputs</h3><span class="small">Editable draft — trainer rules can replace all values.</span></div>
        <div class="grid three">
          ${field("Planned production", `options.${optionIndex}.plannedProduction`, { note: "Units" })}
          ${field("Milk bought", `options.${optionIndex}.milkTonnes`, { step: "0.1", note: "Tonnes" })}
          ${field("Milk price / tonne", `options.${optionIndex}.milkPrice`, { note: "Estimate" })}
          ${field("Milk yield / tonne", `options.${optionIndex}.milkYield`, { note: "Units" })}
          ${field("Sales request", `options.${optionIndex}.salesRequest`, { note: "Units" })}
          ${field("Market investment", `options.${optionIndex}.marketInvestment`, { note: "Estimate" })}
        </div>
      </section>
      <section class="subsection">
        <div class="card-heading"><h3>Premises and transport</h3><button class="button secondary compact" data-action="add-premise" data-option="${optionIndex}" type="button">Add premise</button></div>
        <p class="field-note">For more than one premise, enter its production. Actual sales are allocated by production share; the final whole-unit residual goes to the last premise.</p>
        ${selectedPremiseRows(optionIndex, option)}
      </section>
      <section class="subsection">
        <h3>Machine use and new borrowing</h3>
        <div class="grid three">
          ${field("Machine capacity used", `options.${optionIndex}.machineCapacityUsed`, { note: "Existing capacity; units" })}
          ${field("Existing machine slots used", `options.${optionIndex}.machineSlotsUsed`, { note: "Estimate" })}
          ${field("New machine purchase", `options.${optionIndex}.newMachinePrice`, { note: "Cash item; Sh" })}
          ${field("New machine capacity", `options.${optionIndex}.newMachineCapacity`, { note: "Units, if bought" })}
          ${field("New machine maintenance", `options.${optionIndex}.newMachineMaintenance`, { note: "Per season, if bought" })}
          ${field("New machine useful life", `options.${optionIndex}.newMachineLife`, { note: "Seasons; depreciation calculated" })}
          ${field("New machine slots", `options.${optionIndex}.newMachineSlots`, { note: "If bought" })}
          ${field("New borrowing", `options.${optionIndex}.newBorrowing`, { note: "Received before advance payment" })}
          ${field("New loan term", `options.${optionIndex}.newLoanTerm`, { note: "Seasons" })}
          ${field("New loan interest rate", `options.${optionIndex}.newLoanInterestRate`, { step: "0.1", note: "Per season, %" })}
        </div>
        <p class="field-note">Calculated new-machine depreciation: ${money(result.newMachineDepreciation)}. First new-loan principal repayment: ${money(result.newPrincipal)}.</p>
      </section>
      <section class="subsection">
        <div class="scenario-heading"><h3>Possible allocated sales</h3><span class="small">Select one for the headline comparison.</span></div>
        ${scenarioCards(optionIndex, option, scenarioResults)}
      </section>
      <section class="subsection">
        <div class="result-title"><h3>Selected ${selected} result</h3><span class="small">Sales capped at production and request.</span></div>
        <div class="result-summary">
          <div class="metric"><span class="metric-label">Sales / revenue</span><span class="metric-value">${units(result.actualSales)}<br>${money(result.revenue)}</span></div>
          <div class="metric"><span class="metric-label">Net profit</span><span class="metric-value ${result.netProfit < 0 ? "negative" : "positive"}">${signedMoney(result.netProfit)}</span></div>
          <div class="metric"><span class="metric-label">Closing cash</span><span class="metric-value ${result.closingCash < 0 ? "negative" : ""}">${signedMoney(result.closingCash)}</span></div>
          <div class="metric"><span class="metric-label">Cash before market</span><span class="metric-value ${result.cashBeforeMarket < 0 ? "negative" : ""}">${signedMoney(result.cashBeforeMarket)}</span></div>
          <div class="metric"><span class="metric-label">Spoilage</span><span class="metric-value">${units(result.unusedMilk)} milk<br>${units(result.unsoldIceCream)} ice cream</span></div>
          <div class="metric"><span class="metric-label">Ending debt</span><span class="metric-value">Existing ${money(result.existingDebtEnd)}<br>New ${money(result.newDebtEnd)}</span></div>
        </div>
        <div class="allocation"><strong>Transport allocation:</strong> ${allocated}</div>
        ${result.warnings.length ? `<div class="warning-list">${result.warnings.map((warning) => `<div class="warning">${esc(warning)}</div>`).join("")}</div>` : `<div class="notice success">Capacity, cash timing, and selected-premise checks pass for this estimate.</div>`}
      </section>
      <section class="statements">
        ${statement("Projected Profit & Loss", [["Revenue", result.revenue], ["Milk cost", -result.milkCost], ["Maintenance — all owned machines", -result.maintenance], ["Depreciation — all owned machines", -result.depreciation], ["Gross profit", result.grossProfit, true], ["Transport", -result.transport], ["Market investment", -result.marketInvestment], ["Bonus", -result.bonus], ["Fixed salaries", -result.fixedSalaries], ["Rent", -result.rent], ["Loan interest", -result.interest], ["Profit before tax", result.pbt, true], ["Tax-loss pool used", result.lossPoolUsed], ["Taxable profit", result.taxableProfit], ["Game tax", -result.tax], ["Net profit", result.netProfit, true]])}
        ${statement("Projected Cash Flow", [["Opening cash", result.openingCash], ["New loans received", result.newLoans], ["Sales cash received", result.revenue], ["Machine purchases", -result.machinePurchase], ["Milk purchased", -result.milkCost], ["Market investment", -result.marketInvestment], ["Rent", -result.rent], ["Maintenance", -result.maintenance], ["Transport", -result.transport], ["Fixed salaries", -result.fixedSalaries], ["Bonus", -result.bonus], ["Existing-loan principal", -result.existingPrincipal], ["New-loan principal", -result.newPrincipal], ["Interest", -result.interest], ["Tax", -result.tax], ["Closing cash", result.closingCash, true]])}
      </section>
      <p class="field-note">Ending tax-loss pool: ${money(result.taxLossPoolEnd)}. All displayed financial statement lines use whole-shekel rounding.</p>
    </div>
  </article>`;
}

function diffDrivers(a, b) {
  const candidates = [
    ["actual sales revenue", b.revenue - a.revenue], ["milk purchase cost", b.milkCost - a.milkCost], ["market investment", b.marketInvestment - a.marketInvestment],
    ["rent", b.rent - a.rent], ["transport", b.transport - a.transport], ["machine maintenance and depreciation", (b.maintenance + b.depreciation) - (a.maintenance + a.depreciation)],
    ["interest and principal cash payments", (b.interest + b.existingPrincipal + b.newPrincipal) - (a.interest + a.existingPrincipal + a.newPrincipal)],
    ["spoilage (units of ice cream)", b.unsoldIceCream - a.unsoldIceCream],
  ];
  return candidates.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 4);
}

function recommendation(results, completed) {
  if (!completed) return { name: "Provisional — enter Year 1 autumn closing data", result: null, text: "The workbook records Year 1 Winter and Spring. Until the Year 1 Autumn closing cash, annual profit, owned assets, loan balances, and tax-loss pool are confirmed, no option is financially final." };
  const viable = results.filter((item) => item.result.cashBeforeMarket >= 0 && item.result.closingCash >= 0 && item.result.warnings.filter((warning) => /capacity|slots|required|above/.test(warning)).length === 0);
  const pool = viable.length ? viable : results;
  const chosen = pool.sort((a, b) => b.result.closingCash - a.result.closingCash || b.result.netProfit - a.result.netProfit)[0];
  return { name: chosen.option.name, result: chosen.result, option: chosen.option, text: viable.length ? "This option protects cash before chasing the higher theoretical sale." : "Neither selected plan clears every survival check; this is the least cash-destructive draft." };
}

function renderCompanySection() {
  const company = state.company;
  const machineRows = company.ownedMachines.map((machine, index) => `
    <div class="repeat-row machine-row">
      <input data-path="company.ownedMachines.${index}.name" data-kind="text" value="${esc(machine.name)}" placeholder="Machine name" aria-label="Machine name" />
      <label>Capacity<input data-path="company.ownedMachines.${index}.capacity" data-kind="number" type="number" min="0" step="1" value="${esc(machine.capacity)}" /></label>
      <label>Maintenance<input data-path="company.ownedMachines.${index}.maintenance" data-kind="number" type="number" min="0" step="1" value="${esc(machine.maintenance)}" /></label>
      <label>Depreciation<input data-path="company.ownedMachines.${index}.depreciation" data-kind="number" type="number" min="0" step="1" value="${esc(machine.depreciation)}" /></label>
      <label>Life left<input data-path="company.ownedMachines.${index}.remainingLife" data-kind="number" type="number" min="0" step="1" value="${esc(machine.remainingLife)}" /></label>
      <button class="icon-button" data-action="remove-machine" data-row="${index}" type="button" aria-label="Remove machine">×</button>
    </div>`).join("");
  const loanRows = company.existingLoans.map((loan, index) => `
    <div class="repeat-row loan-row">
      <input data-path="company.existingLoans.${index}.name" data-kind="text" value="${esc(loan.name)}" placeholder="Loan name" aria-label="Loan name" />
      <label>Opening debt<input data-path="company.existingLoans.${index}.debt" data-kind="number" type="number" min="0" step="1" value="${esc(loan.debt)}" /></label>
      <label>Principal due<input data-path="company.existingLoans.${index}.principalDue" data-kind="number" type="number" min="0" step="1" value="${esc(loan.principalDue)}" /></label>
      <label>Rate %<input data-path="company.existingLoans.${index}.interestRate" data-kind="number" type="number" min="0" step="0.1" value="${esc(loan.interestRate)}" /></label>
      <button class="icon-button" data-action="remove-loan" data-row="${index}" type="button" aria-label="Remove loan">×</button>
    </div>`).join("");
  return `<section class="card section">
    <div class="section-title-row"><div><span class="estimate-label">Required actual Year 1 autumn input</span><h2>Year 1 actual closing position</h2></div><span class="small">Workbook import status: Winter and Spring recorded; Summer–Autumn closing data not present.</span></div>
    <p class="field-note">These values are intentionally blank. The workbook has the real Year 1 Winter and Spring results but does not provide a completed Year 1 Autumn closing position. Enter the class model values; use zero only when it is genuinely zero.</p>
    <div class="grid three">
      ${field("Closing cash after Year 1 Autumn", "company.openingCash", { required: true, note: "Opening cash for Year 2 Winter" })}
      ${field("Year 1 annual net profit", "company.annualProfit", { required: true, note: "Reference only" })}
      ${field("Unused tax-loss pool", "company.taxLossPool", { required: true, note: "At start of Year 2 Winter" })}
    </div>
    <div class="subsection"><div class="card-heading"><h3>Owned machines at Year 1 Autumn</h3><button class="button secondary compact" type="button" data-action="add-machine">Add machine</button></div><p class="field-note">Maintenance and depreciation are charged even when a machine is idle. Record every machine, or remove blank rows then confirm none.</p><div class="repeat-list">${machineRows}</div>${field("I have entered every owned machine (or confirmed none)", "company.machinesConfirmed", { type: "checkbox", required: true })}</div>
    <div class="subsection"><div class="card-heading"><h3>Unpaid loans at Year 1 Autumn</h3><button class="button secondary compact" type="button" data-action="add-loan">Add loan</button></div><p class="field-note">Interest is calculated on opening debt before repayment. Record every loan, or remove blank rows then confirm none.</p><div class="repeat-list">${loanRows}</div>${field("I have entered every unpaid loan (or confirmed none)", "company.loansConfirmed", { type: "checkbox", required: true })}</div>
  </section>`;
}

function renderAssumptions() {
  return `<section class="card section"><div class="section-title-row"><div><span class="estimate-label">Replace when trainer gives new rules</span><h2>Year 2 Winter estimates</h2></div><span class="small">These are editable estimates, not confirmed Year 2 prices or rules.</span></div>
    <div class="grid four">
      ${field("Selling price / unit", "assumptions.sellingPrice", { step: "0.01", note: "Estimate" })}
      ${field("Fixed salaries", "assumptions.fixedSalaries", { note: "Estimate" })}
      ${field("Bonus rate", "assumptions.bonusRate", { step: "0.1", note: "Gross-profit bonus, %" })}
      ${field("Game tax rate", "assumptions.taxRate", { step: "0.1", note: "Taxable-profit tax, %" })}
    </div>
  </section>`;
}

function renderCockpit(optionResults) {
  const complete = companyIsComplete(state.company);
  const headline = optionResults.map((item) => `<article class="headline-option"><h3>${esc(item.option.name)}</h3><p>${item.option.selectedScenario[0].toUpperCase() + item.option.selectedScenario.slice(1)}: ${units(item.result.actualSales)} sales</p><div class="result-summary"><div class="metric"><span class="metric-label">Net</span><span class="metric-value ${item.result.netProfit < 0 ? "negative" : "positive"}">${signedMoney(item.result.netProfit)}</span></div><div class="metric"><span class="metric-label">Cash</span><span class="metric-value ${item.result.closingCash < 0 ? "negative" : ""}">${signedMoney(item.result.closingCash)}</span></div></div>${item.result.warnings.length ? `<p class="negative">${item.result.warnings.length} risk warning${item.result.warnings.length === 1 ? "" : "s"}</p>` : `<p class="positive">No selected-plan warnings</p>`}</article>`).join("");
  return `<section class="card cockpit"><div class="section-title-row"><div><span class="estimate-label">Decision snapshot</span><h2>Start here: actual position and option comparison</h2></div><span class="small">Detailed machines, loans, P&L, and cash flow follow.</span></div><div class="cockpit-grid"><div><div class="grid three">${field("Year 1 Autumn closing cash", "company.openingCash", { required: true })}${field("Year 1 annual net profit", "company.annualProfit", { required: true })}${field("Tax-loss pool", "company.taxLossPool", { required: true })}</div><div class="notice ${complete ? "success" : "danger"}"><strong>${complete ? "Ready for a financial recommendation" : "Provisional — enter Year 1 autumn closing data"}</strong><br>${complete ? "Assets and unpaid loans are confirmed below." : "Enter the three figures here, then complete the machine and loan lists below."}</div></div><div class="headline-options">${headline}</div></div></section>`;
}

function renderValidation() {
  const winterCompany = { openingCash: 100000, taxLossPool: 0, ownedMachines: [], existingLoans: [] };
  const winterAssumptions = { sellingPrice: 2, fixedSalaries: 10000, bonusRate: 5, taxRate: 10 };
  const winterOption = { plannedProduction: 70000, milkTonnes: 3.5, milkPrice: 20000, milkYield: 20000, salesRequest: 70000, marketInvestment: 8000, machineCapacityUsed: 0, machineSlotsUsed: 0, newMachinePrice: 35000, newMachineCapacity: 72000, newMachineMaintenance: 1800, newMachineLife: 8, newMachineSlots: 1, newBorrowing: 50000, newLoanTerm: 8, newLoanInterestRate: 10, premises: [{ name: "D", active: true, slots: 1, rent: 17000, transport: .1, production: 70000 }] };
  const result = calculate(winterCompany, winterAssumptions, winterOption, 60000);
  const passed = result.netProfit === -4366 && result.closingCash === 108759 && result.taxLossPoolEnd === 4366;
  return `<section class="card section" data-testid="year1-validation"><div class="section-title-row"><div><h2>Year 1 calculation check</h2><p class="small">Independent recorded Winter season — this must pass before the tool is deployed.</p></div><div class="notice ${passed ? "success" : "danger"}"><strong data-testid="validation-status">${passed ? "PASS" : "FAIL"}</strong><br>${passed ? "Matches the classroom result." : "Trace and correct the formula before deployment."}</div></div>
    <div class="check-grid"><div class="check-result"><span class="metric-label">Recorded inputs</span><p class="small">Opening cash Sh 100,000 · M1 purchase Sh 35,000 · 3.5t milk at Sh 20,000/t · 70,000 produced/requested · 60,000 allocated sales · Sh 8,000 market investment · D rent Sh 17,000 · 10% loan/season.</p></div>
    <div class="grid three"><div class="metric"><span class="metric-label">Net loss</span><span class="metric-value ${result.netProfit === -4366 ? "positive" : "negative"}">${signedMoney(result.netProfit)}<br><span class="small">Expected −Sh 4,366</span></span></div><div class="metric"><span class="metric-label">Closing cash</span><span class="metric-value ${result.closingCash === 108759 ? "positive" : "negative"}">${money(result.closingCash)}<br><span class="small">Expected Sh 108,759</span></span></div><div class="metric"><span class="metric-label">Tax-loss pool added</span><span class="metric-value ${result.taxLossPoolEnd === 4366 ? "positive" : "negative"}">${money(result.taxLossPoolEnd)}<br><span class="small">Expected Sh 4,366</span></span></div></div></div>
    <p class="field-note">Trace: revenue ${money(result.revenue)} − milk ${money(result.milkCost)} − maintenance ${money(result.maintenance)} − depreciation ${money(result.depreciation)} = gross profit ${signedMoney(result.grossProfit)}; then transport, market, bonus, salaries, rent, and interest produce the expected loss.</p>
  </section>`;
}

function renderSpringActual() {
  const company = {
    openingCash: 108759,
    taxLossPool: 4366,
    ownedMachines: [{ name: "Machine 1", capacity: 72000, maintenance: 1800, depreciation: 4375, remainingLife: 7 }],
    existingLoans: [{ name: "Loan 1", debt: 43750, principalDue: 6250, interestRate: 10 }],
  };
  const assumptions = { sellingPrice: 2, fixedSalaries: 10000, bonusRate: 5, taxRate: 10 };
  const option = {
    plannedProduction: 140000, milkTonnes: 7, milkPrice: 20000, milkYield: 20000,
    salesRequest: 140000, marketInvestment: 10000, machineCapacityUsed: 72000, machineSlotsUsed: 1,
    newMachinePrice: 35000, newMachineCapacity: 72000, newMachineMaintenance: 1800, newMachineLife: 8, newMachineSlots: 1,
    newBorrowing: 80000, newLoanTerm: 8, newLoanInterestRate: 10,
    premises: [{ name: "E", active: true, slots: 2, rent: 15000, transport: 0.2, production: 140000 }],
  };
  const result = calculate(company, assumptions, option, 110000);
  const passed = result.netProfit === -5108 && result.closingCash === 141151 && result.taxLossPoolEnd === 9474;
  return `<section class="card section" data-testid="year1-spring-actual"><div class="section-title-row"><div><h2>Year 1 Spring actual</h2><p class="small">Recorded decision and market result for Team 1.</p></div><div class="notice ${passed ? "success" : "danger"}"><strong>${passed ? "RECORDED" : "CHECK INPUTS"}</strong><br>${passed ? "Spring totals agree with the updated model." : "The record needs review."}</div></div>
    <div class="check-grid"><div class="check-result"><span class="metric-label">Confirmed decision and allocation</span><p class="small">Sh 10,000 market investment · 140,000 requested and produced · 7 tonnes of milk · two Machine 1 units · Premise E only · Sh 80,000 borrowing · 110,000 allocated sales · Sh 220,000 revenue.</p><p class="field-note">The Sh 80,000 loan is currently modelled over eight seasons, matching the original loan convention. Change this if the team chose a different term.</p></div>
    <div class="grid four"><div class="metric"><span class="metric-label">Net loss</span><span class="metric-value negative">${signedMoney(result.netProfit)}</span></div><div class="metric"><span class="metric-label">Closing cash</span><span class="metric-value positive">${money(result.closingCash)}</span></div><div class="metric"><span class="metric-label">Cash before market</span><span class="metric-value positive">${money(result.cashBeforeMarket)}</span></div><div class="metric"><span class="metric-label">Ending tax-loss pool</span><span class="metric-value">${money(result.taxLossPoolEnd)}</span></div></div></div>
    <p class="field-note">Transport from Premise E is ${money(result.transport)}. Spring rent is ${money(result.rent)}, and bank interest is ${money(result.interest)}.</p>
  </section>`;
}

function renderRecommendation(results, lowResults) {
  const complete = companyIsComplete(state.company);
  const pick = recommendation(results, complete);
  const low = pick.option ? lowResults.find((item) => item.option === pick.option)?.result : null;
  const selectedScenario = pick.option?.selectedScenario;
  const driverText = diffDrivers(results[0].result, results[1].result).map(([label, difference]) => {
    const direction = difference === 0 ? "the same" : difference > 0 ? "higher in Option B" : "lower in Option B";
    return `<li><strong>${esc(label)}</strong>: ${difference === 0 ? direction : `${money(Math.abs(difference))} ${direction}`}</li>`;
  }).join("");
  return `<section class="card section recommendation"><div class="section-title-row"><div><h2>Recommendation</h2><p class="small">Draft logic favours cash survival over theoretical profit.</p></div><span class="estimate-label">Editable draft</span></div>
    <div class="recommendation-grid"><div class="metric"><span class="metric-label">Recommended option</span><span class="metric-value">${esc(pick.name)}</span></div><div class="metric"><span class="metric-label">Selected sales scenario</span><span class="metric-value">${selectedScenario ? esc(selectedScenario) : "—"}</span></div><div class="metric"><span class="metric-label">Expected closing cash</span><span class="metric-value ${pick.result?.closingCash < 0 ? "negative" : ""}">${pick.result ? signedMoney(pick.result.closingCash) : "—"}</span></div><div class="metric"><span class="metric-label">Expected net profit / loss</span><span class="metric-value ${pick.result?.netProfit < 0 ? "negative" : ""}">${pick.result ? signedMoney(pick.result.netProfit) : "—"}</span></div></div>
    <div class="notice ${complete ? "" : "danger"}"><strong>${complete ? "Most important assumption:" : "Status:"}</strong> ${esc(complete ? "Actual sales allocation is uncertain; the company previously received 60,000 sales from a 70,000-unit request." : pick.text)}</div>
    ${low ? `<p><strong>If sales fall to the low scenario:</strong> projected closing cash becomes <span class="${low.closingCash < 0 ? "negative" : ""}">${signedMoney(low.closingCash)}</span> and net profit becomes <span class="${low.netProfit < 0 ? "negative" : ""}">${signedMoney(low.netProfit)}</span>. ${low.cashBeforeMarket < 0 || low.closingCash < 0 ? "This breaks a cash-survival check." : "The plan remains cash-positive, but assumes no other surprise costs."}</p>` : ""}
    <div class="subsection"><h3>Why the options differ</h3><ul class="driver-list">${driverText}</ul></div>
  </section>`;
}

function render() {
  const optionResults = state.options.map((option) => {
    const scenarios = Object.fromEntries(["low", "base", "high"].map((scenario) => [scenario, calculate(state.company, state.assumptions, option, option.scenarios[scenario])]));
    return { option, result: scenarios[option.selectedScenario], scenarios };
  });
  const lowResults = state.options.map((option) => ({ option, result: calculate(state.company, state.assumptions, option, option.scenarios.low) }));
  document.getElementById("app").innerHTML = `${renderCockpit(optionResults)}${renderCompanySection()}${renderAssumptions()}<section class="comparison-grid" aria-label="Year 2 option comparison">${optionResults.map((item, index) => optionCard(index, item.option, item.result, item.scenarios)).join("")}</section>${renderRecommendation(optionResults, lowResults)}${renderValidation()}${renderSpringActual()}<p class="footer-note">Saved automatically in this browser. Year 2 assumptions are estimates until trainer rules are issued.</p>`;
}

function addRow(action, optionIndex) {
  if (action === "add-machine") state.company.ownedMachines.push({ name: "", capacity: "", maintenance: "", depreciation: "", remainingLife: "" });
  if (action === "add-loan") state.company.existingLoans.push({ name: "", debt: "", principalDue: "", interestRate: "" });
  if (action === "add-premise") state.options[optionIndex].premises.push({ name: "", active: true, slots: 1, rent: 0, transport: 0, production: 0 });
}

document.addEventListener("input", (event) => {
  const fieldElement = event.target.closest("[data-path]");
  if (!fieldElement) return;
  const kind = fieldElement.dataset.kind;
  if (kind === "checkbox") setPath(fieldElement.dataset.path, fieldElement.checked);
  else if (kind === "number") setPath(fieldElement.dataset.path, fieldElement.value === "" ? "" : Number(fieldElement.value));
  else if (kind === "radio") setPath(fieldElement.dataset.path, fieldElement.dataset.value);
  else setPath(fieldElement.dataset.path, fieldElement.value);
  saveState();
});
document.addEventListener("change", (event) => {
  if (event.target.closest("[data-path]")) render();
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const optionIndex = Number(button.dataset.option);
  const row = Number(button.dataset.row);
  if (action === "add-machine" || action === "add-loan" || action === "add-premise") addRow(action, optionIndex);
  if (action === "remove-machine") state.company.ownedMachines.splice(row, 1);
  if (action === "remove-loan") state.company.existingLoans.splice(row, 1);
  if (action === "remove-premise") state.options[optionIndex].premises.splice(row, 1);
  saveState(); render();
});
document.getElementById("reset-button").addEventListener("click", () => {
  state = clone(initialState); saveState(); render();
});

render();

// Exported for a simple browser-console check and future unit tests.
window.PorkGarlicCalculator = { calculate, initialState: clone(initialState), companyIsComplete };
