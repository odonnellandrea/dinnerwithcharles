import React from 'react'
import { BASE_PRICE, BASE_ENTREES, BASE_SALADS, EXTRA_ENTREE_PRICE, EXTRA_SALAD_PRICE } from '../lib/pricing'
import '../styles/landing.css'

const INSTAGRAM_URL = 'https://www.instagram.com/dinnerwithcharles/'

const STEPS = [
  {
    title: 'A new menu each week',
    body: 'Every week we write a fresh menu of entrées, salads and extras, built around what’s in season.'
  },
  {
    title: 'Choose what you love',
    body: `Pick ${BASE_ENTREES} entrées and ${BASE_SALADS} salads for your household. Want more? Add extra dishes or an add-on to round out the week.`
  },
  {
    title: 'We cook from scratch',
    body: 'Every dish is cooked from scratch, fresh for delivery day, with the care we’d give our own family’s dinner.'
  },
  {
    title: 'Delivered to your door',
    body: 'Choose the delivery windows that work for you. Every container comes labeled, with simple reheat instructions.'
  }
]

export default function LandingPage({ onSignIn, onJoin }) {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-wrap">
          <a href="/" className="landing-logo" aria-label="Dinner with Charles home"><img src="/Green Horizontal Logo.png" alt="Dinner with Charles" /></a>
          <div className="landing-header-actions">
            <button className="landing-link" onClick={onSignIn}>Sign In</button>
            <button className="landing-btn" onClick={onJoin}>Request to Join</button>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-wrap">
          <div>
            <p className="landing-eyebrow">Weekly Kitchen</p>
            <h1>Your own private chef, cooking for your family the way we cook for ours.</h1>
            <p>
              Each week we cook a fresh menu of entrées and salads from scratch and deliver it to your door,
              ready to reheat and enjoy. Weeknight dinners, taken care of.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-btn" onClick={onJoin}>Request to Join</button>
              <button className="landing-btn landing-btn--outline" onClick={onSignIn}>Sign In</button>
            </div>
          </div>
          <img className="landing-hero-photo" src="/images/steak-sauce.jpg" alt="Sauce spooned over sliced steak with crisp potatoes" />
        </div>
      </section>

      <section className="landing-section landing-section--white">
        <div className="landing-wrap">
          <div className="landing-section-head">
            <p className="landing-eyebrow">How it works</p>
            <h2>Home cooking, without the cooking.</h2>
          </div>
          <div className="landing-steps">
            {STEPS.map((step, idx) => (
              <div key={step.title} className="landing-step">
                <p className="landing-step-num">0{idx + 1}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band" role="img" aria-label="Tomato spaghetti being plated with tongs">
        <div className="landing-wrap">
          <p className="landing-eyebrow">The menu</p>
          <h2>Inspired by where we’ve traveled and what we love to eat.</h2>
          <p>
            Menus change every week, from Japanese beef curry to rigatoni alla Norma, so there’s always
            something new to look forward to.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-wrap">
          <p className="landing-eyebrow">From our kitchen</p>
          <div className="landing-gallery">
            <img src="/images/soup-greens.jpg" alt="Creamy potato and greens soup topped with seared sausage and microgreens" />
            <img className="landing-gallery-low" src="/images/salmon-mushroom-bowl.jpg" alt="Seared salmon and roasted mushrooms over rice in a blue bowl, beside a white teapot" />
            <img className="landing-gallery-right" src="/images/beets-pistachio.jpg" alt="Roasted beets over whipped cheese with pistachios and microgreens" />
            <img className="landing-gallery-low" src="/images/torch-brulee.jpg" alt="A kitchen torch caramelizing sugar on a dessert" />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--white">
        <div className="landing-wrap landing-about landing-about--flip">
          <img src="/images/sesame-packet.jpg" alt="Packets of toasted sesame seeds labeled Add to cabbage salad" />
          <div>
            <p className="landing-eyebrow">The details</p>
            <h2>Thoughtful down to the last sprinkle.</h2>
            <p>
              Crunchy toppings, dressings and garnishes come packed on the side and labeled for the dish they
              belong to, so everything tastes as fresh at your table as it did in our kitchen.
            </p>
            <p>
              Every container is labeled, and every delivery comes with a reheat guide written for that
              week’s menu.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-wrap landing-plan">
          <img src="/images/roast-chicken-wide.jpg" alt="Sliced roast chicken with mustard sauce, baby potatoes and carrots" />
          <div>
            <p className="landing-eyebrow">Your week</p>
            <div className="landing-price-card">
              <p className="landing-price">${BASE_PRICE}</p>
              <p className="landing-price-sub">{BASE_ENTREES} entrées + {BASE_SALADS} salads, cooked and delivered</p>
              <p className="landing-price-serves">Each dish serves two to three, depending on the dish and the appetites at your table.</p>
              <ul className="landing-price-list">
                <li><span>Extra entrée</span><span>${EXTRA_ENTREE_PRICE} each</span></li>
                <li><span>Extra salad</span><span>${EXTRA_SALAD_PRICE} each</span></li>
                <li><span>Optional add-ons</span><span>Priced weekly</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--white">
        <div className="landing-wrap landing-about">
          <img src="/images/pastry-bites.jpg" alt="Golden pastry bites with chopsticks and a cup of soup" />
          <div>
            <p className="landing-eyebrow">Who we are</p>
            <h2>A kitchen that cooks like family.</h2>
            <p>
              Dinner with Charles started the way most good meals do: cooking for the people around our own table.
              Weekly Kitchen brings that same food to yours.
            </p>
            <p>
              Every dish is cooked from scratch with real ingredients and real care. The menu follows the seasons
              and the places we’ve traveled, and it’s always made the way we’d make it at home.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-join">
        <div className="landing-wrap">
          <p className="landing-eyebrow">Join us</p>
          <h2>Pull up a chair.</h2>
          <p>
            Tell us a little about your household and we’ll be in touch to get your first week of dinners
            on the table.
          </p>
          <button className="landing-btn landing-btn--light" onClick={onJoin}>Request to Join</button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-wrap landing-follow">
          <div>
            <p className="landing-eyebrow">Follow along</p>
            <h3>See what’s cooking on Instagram.</h3>
            <p>New menus, behind-the-scenes moments and the latest from our kitchen.</p>
          </div>
          <a className="landing-btn landing-btn--ghost-light" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Follow @dinnerwithcharles
          </a>
        </div>
        <div className="landing-wrap landing-footer-bottom">
          <a href="/" className="landing-logo" aria-label="Dinner with Charles home"><img src="/Cream Horizontal Logo.png" alt="Dinner with Charles" /></a>
          <div className="landing-footer-links">
            <button className="landing-link" onClick={onSignIn}>Sign In</button>
            <small>© {new Date().getFullYear()} Dinner with Charles</small>
          </div>
        </div>
      </footer>
    </div>
  )
}
