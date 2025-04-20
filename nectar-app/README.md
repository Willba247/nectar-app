**Tech Stack**

- NextJs
- Supabase
- Tailwind
- tRPC
- Stripe
- Capacitor

**Payments**

**!IMPORTANT**

- Apple and google pay are only shown on supported browsers which can be found here: https://docs.stripe.com/elements/express-checkout-element
- If a google or apple pay hasn't been setup by user, the option won't be displayed

For MVP:

- All funds go into platform account (Nectar)
- All transactions are recorded in our db
- Pay venues monthly using bank transfers or straight from stripe

Other options:

- If venues want individual payments into their accounts:
  - Create connect accounts for the venues
  - Update payment flow to use destination charges or direct charges

Considerations:

- A hybrid approach (some venues monthly and others immediate payout) is possible, but will be complicated to setup
- Better to keep it simple - one way or the other unless their is significant demand for both methods

**TODO**
[ ] Terms and conditions
[ ] Update supabase webhook to use correct domain
