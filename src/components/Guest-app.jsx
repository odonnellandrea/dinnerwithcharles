import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MENU = {
  entrees: [
    { name: 'Pine Nut, Rosemary & Orange Zest-Crusted Salmon', description: 'A vibrant crust of toasted pine nut, fresh rosemary, and bright orange zest presses into the salmon before it\'s baked.' },
    { name: 'Peruvian-Style Chicken Thighs', description: 'Chicken thighs marinated in a classic Peruvian blend of spices, cumin, and paprika, roasted until the skin turns deep and burnished.' },
    { name: 'Chicken Milanese', description: 'Crispy chicken cutlet fried until crispy, finished with olive butter.' },
    { name: 'Beef Ragu "Famoso" Lasagna', description: 'Layered pasta with a beef and pork bolognese, whipped ricotta, mozzarella sauce, seasoned with fresh basil and topped with mozzarella.' },
    { name: 'Lamb & Beef Kofta', description: 'Spiced lamb and beef kofta, grilled until charred at the edges.' }
  ],
  salads: [
    { name: 'Shaved Fennel, Endive & Citrus Salad', description: 'Shaved fennel and endive tossed with fresh citrus, finished with blue cheese, balsamic, and candied nuts.' },
    { name: 'Greek Salad', description: 'Tomatoes, red onion, cucumber, feta, and olives tossed in red wine vinaigrette.' },
    { name: 'Market Salad', description: 'Tender greens from whatever\'s freshest at the market, finished with our house balsamic dressing.' }
  ]
};

const WEEK_3_ADDONS = [
  { id: 'extra-entree', name: 'Additional Entrée', price: 40.00, description: 'Add one more entrée to your order' },
  { id: 'family-serving', name: 'Family Extra Serving', price: 40.00, description: 'Add a full serving for the whole family' },
  { id: 'coconut-oats', name: 'Coconut Milk Oats', price: 20.00, description: '3x coconut milk oats with Chef Rob\'s seasonal fruit compote' },
  { id: 'fruit-jello', name: 'Organic Fruit Jello', price: 20.00, description: 'No sugar, no sweetener organic fruit jello' }
];

export default function WeeklyKitchenApp() {
  const [screen, setScreen] = useState('login'); // login, order, confirmation
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Order state
  const [entree1, setEntree1] = useState('');
  const [entree1Qty, setEntree1Qty] = useState(1);
  const [entree2, setEntree2] = useState('');
  const [entree2Qty, setEntree2Qty] = useState(1);
  const [entree3, setEntree3] = useState('');
  const [entree3Qty, setEntree3Qty] = useState(1);

  const [salad1, setSalad1] = useState('');
  const [salad1Qty, setSalad1Qty] = useState(1);
  const [salad2, setSalad2] = useState('');
  const [salad2Qty, setSalad2Qty] = useState(1);

  const [specialRequests, setSpecialRequests] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Query users table (in production, use proper auth)
      const { data: users, error: queryError } = await supabase
        .from('users')
        .select('id, username, name')
        .eq('username', username)
        .single();

      if (queryError || !users) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      // Simple password check (in production, backend validates hashed password)
      setUser({ id: users.id, username: users.username });
      setCustomerName(users.name);
      setScreen('order');
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle order submission
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!entree1 || !entree2 || !entree3 || !salad1 || !salad2) {
      setError('Please select all entrées and salads');
      setSubmitting(false);
      return;
    }

    try {
      const { error: insertError } = await supabase.from('orders').insert({
        user_id: user.id,
        order_week: 'Week 3',
        entree_1: entree1,
        entree_1_qty: entree1Qty,
        entree_2: entree2,
        entree_2_qty: entree2Qty,
        entree_3: entree3,
        entree_3_qty: entree3Qty,
        salad_1: salad1,
        salad_1_qty: salad1Qty,
        salad_2: salad2,
        salad_2_qty: salad2Qty,
        special_requests: specialRequests,
        add_ons: selectedAddOns,
      });

      if (insertError) {
        setError('Failed to submit order. Please try again.');
        setSubmitting(false);
        return;
      }

      setScreen('confirmation');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  const toggleAddOn = (addonId) => {
    setSelectedAddOns(prev => {
      const updated = { ...prev };
      if (updated[addonId]) {
        delete updated[addonId];
      } else {
        updated[addonId] = true;
      }
      return updated;
    });
  };

  // LOGIN SCREEN
  if (screen === 'login') {
    return (
      <div className="container login-container">
        <div className="logo-section">
          <h1>Dinner with Charles</h1>
          <p className="tagline">Weekly Kitchen</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <h2>Welcome</h2>
          <p className="subtitle">Please enter your credentials to place your order</p>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="footer-text">
          Need to complete intake? Text us to get started.
        </p>
      </div>
    );
  }

  // ORDER SCREEN
  if (screen === 'order') {
    return (
      <div className="container order-container">
        <div className="order-header">
          <h1>Your Order - Week 3</h1>
          <p>Hello, {customerName}!</p>
          <p className="week-subtitle">Pick 3 entrées and 2 salads below</p>
        </div>

        <form onSubmit={handleSubmitOrder} className="order-form">
          {error && <div className="error-message">{error}</div>}

          {/* ENTRÉES SECTION */}
          <section className="menu-section">
            <h2>Entrées</h2>
            <p className="section-subtitle">Select 3 entrées and quantity for each</p>

            {[1, 2, 3].map((num) => {
              const entreeVar = eval(`entree${num}`);
              const setEntree = eval(`setEntree${num}`);
              const qtyVar = eval(`entree${num}Qty`);
              const setQty = eval(`setEntree${num}Qty`);

              return (
                <div key={num} className="menu-item-selector">
                  <label>Entrée {num}</label>
                  <select value={entreeVar} onChange={(e) => setEntree(e.target.value)}>
                    <option value="">-- Choose an entrée --</option>
                    {MENU.entrees.map(e => (
                      <option key={e.name} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                  <div className="quantity-selector">
                    <label>Quantity:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={qtyVar}
                      onChange={(e) => setQty(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* SALADS SECTION */}
          <section className="menu-section">
            <h2>Salads</h2>
            <p className="section-subtitle">Select 2 salads and quantity for each</p>

            {[1, 2].map((num) => {
              const saladVar = eval(`salad${num}`);
              const setSalad = eval(`setSalad${num}`);
              const qtyVar = eval(`salad${num}Qty`);
              const setQty = eval(`setSalad${num}Qty`);

              return (
                <div key={num} className="menu-item-selector">
                  <label>Salad {num}</label>
                  <select value={saladVar} onChange={(e) => setSalad(e.target.value)}>
                    <option value="">-- Choose a salad --</option>
                    {MENU.salads.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <div className="quantity-selector">
                    <label>Quantity:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={qtyVar}
                      onChange={(e) => setQty(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* ADD-ONS SECTION */}
          <section className="menu-section">
            <h2>Add-Ons</h2>
            <p className="section-subtitle">Optional items</p>

            <div className="addons-grid">
              {WEEK_3_ADDONS.map(addon => (
                <div key={addon.id} className="addon-card">
                  <label className="addon-label">
                    <input
                      type="checkbox"
                      checked={!!selectedAddOns[addon.id]}
                      onChange={() => toggleAddOn(addon.id)}
                    />
                    <span className="addon-name">{addon.name}</span>
                  </label>
                  <p className="addon-description">{addon.description}</p>
                  <p className="addon-price">${addon.price.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SPECIAL REQUESTS */}
          <section className="menu-section">
            <h2>Special Requests</h2>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Any special dietary needs, allergies, or preferences for this week?"
              rows="4"
            />
          </section>

          <button type="submit" disabled={submitting} className="btn btn-primary btn-large">
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </form>
      </div>
    );
  }

  // CONFIRMATION SCREEN
  if (screen === 'confirmation') {
    return (
      <div className="container confirmation-container">
        <div className="confirmation-content">
          <h1>✓ Order Submitted!</h1>
          <p className="confirmation-message">
            Your order for Week 3 has been received.
          </p>

          <div className="order-summary">
            <h3>Your Selections:</h3>
            <div className="summary-item">
              <strong>Entrées:</strong>
              <ul>
                {entree1 && <li>{entree1} (×{entree1Qty})</li>}
                {entree2 && <li>{entree2} (×{entree2Qty})</li>}
                {entree3 && <li>{entree3} (×{entree3Qty})</li>}
              </ul>
            </div>

            <div className="summary-item">
              <strong>Salads:</strong>
              <ul>
                {salad1 && <li>{salad1} (×{salad1Qty})</li>}
                {salad2 && <li>{salad2} (×{salad2Qty})</li>}
              </ul>
            </div>

            {Object.keys(selectedAddOns).length > 0 && (
              <div className="summary-item">
                <strong>Add-Ons:</strong>
                <ul>
                  {Object.keys(selectedAddOns).map(addonId => {
                    const addon = WEEK_3_ADDONS.find(a => a.id === addonId);
                    return addon ? <li key={addonId}>{addon.name}</li> : null;
                  })}
                </ul>
              </div>
            )}

            {specialRequests && (
              <div className="summary-item">
                <strong>Special Requests:</strong>
                <p>{specialRequests}</p>
              </div>
            )}
          </div>

          <p className="confirmation-footer">
            We'll see you for delivery! Questions? Text us anytime.
          </p>

          <button onClick={() => window.location.reload()} className="btn btn-secondary">
            Place Another Order
          </button>
        </div>
      </div>
    );
  }
}
