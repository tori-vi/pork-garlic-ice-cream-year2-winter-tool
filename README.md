# Pork and Garlic Ice Cream Co. — Year 2 Winter Decision Tool

A small, static financial decision tool for comparing two Year 2 Winter plans. It is intentionally a calculator/dashboard, not a marketing site. No server, account, or package installation is needed.

## Run locally

Open `index.html` in a browser, or serve this folder with any static web server. For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## What to enter first

The supplied workbook records the Year 1 Winter season only; it does not contain completed Year 1 Autumn closing values. The top section is therefore deliberately blank and labelled **Required actual Year 1 autumn input**. Enter:

- closing cash after Year 1 Autumn;
- Year 1 annual net profit;
- unused tax-loss pool;
- every machine still owned, including capacity, seasonal maintenance, seasonal depreciation, and useful life remaining;
- every unpaid loan, including opening debt, that season's scheduled principal repayment, and interest rate.

Confirm the assets and loan lists (or confirm none) before treating the recommendation as final.

## Calculation rules

- Revenue is actual allocated sales × selling price. Allocated sales are capped by sales request and feasible production.
- Feasible production is limited by declared machine capacity and milk yield. Purchased milk is fully expensed; unused milk and unsold ice cream spoil.
- All owned machines have maintenance and depreciation, even if idle. A new machine is a cash purchase but depreciates in the season bought: purchase price ÷ useful life in seasons.
- Each active premise has its own rent, slots, transport rate, and production. Actual sales are allocated in production proportion; the final whole-unit rounding residual goes to the final premise.
- Bonus is 5% of positive gross profit. Tax is 10% of profit after using carried tax losses. A loss increases the tax-loss pool.
- Existing-loan interest uses opening debt before repayment. A new loan receives full first-season interest and one equal principal repayment in the same season. Principal is cash flow, not P&L.
- The tool checks both cash before market (`opening cash + new borrowing − machine purchases − milk − market`) and ending cash.
- Financial-statement lines are shown in whole shekels.

## Year 1 validation included

The page independently verifies the recorded Year 1 Winter test case:

- net loss: **Sh 4,366**;
- closing cash: **Sh 108,759**;
- tax-loss pool added: **Sh 4,366**.

The dashboard displays PASS only when all three values agree.

## Year 2 values are estimates

Selling price, salaries, tax/bonus rates, milk economics, premises, machines, market spending, and loans are editable Year 2 estimates. The tool does not claim any Year 1 option price, capacity, rent, or demand is confirmed for Year 2. Replace them when the trainer issues new rules.

Edits are saved to browser local storage. **Restore initial draft** removes saved edits and restores the cautious/ambitious starter options.
