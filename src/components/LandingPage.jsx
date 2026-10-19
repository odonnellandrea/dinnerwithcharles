import React from 'react'
import { BASE_PRICE, BASE_ENTREES, BASE_SALADS, EXTRA_ENTREE_PRICE, EXTRA_SALAD_PRICE } from '../lib/pricing'
import '../styles/landing.css'

const INSTAGRAM_URL = 'https://www.instagram.com/dinnerwithcharles/'

const STEPS = [
  {
    title: 'A new menu each week',
    body: 'Every week we write a fresh menu: a handful of entrées, a few salads and a couple of extras, built around what’s in season.'
  },
  {
    title: 'Choose what you love',
    body: `Pick ${BASE_ENTREES} entrées and ${BASE_SALADS} salads for your household. Want more? Add extra dishes or an add-on to round out the week.`
  },
  {
    title: 'We cook from scratch',
    body: 'Everything is made by us in small batches, cooked fresh for delivery day.'
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
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" />
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
              Each week we cook a small menu of entrées and salads from scratch and deliver it to your door,
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
        <div className="landing-wrap landing-plan">
          <img src="/images/curry-bowl.jpg" alt="Curry over rice garnished with cilantro" />
          <div>
            <p className="landing-eyebrow">Your week</p>
            <div className="landing-price-card">
              <p className="landing-price">${BASE_PRICE}</p>
              <p className="landing-price-sub">{BASE_ENTREES} entrées + {BASE_SALADS} salads, cooked and delivered</p>
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
            <h2>A small kitchen that cooks like family.</h2>
            <p>
              Dinner with Charles started the way most good meals do: cooking for the people around our own table.
              Weekly Kitchen brings that same food to yours.
            </p>
            <p>
              We cook every dish ourselves, in small batches, for a small group of families. The menu follows the
              seasons and the places we’ve traveled, and it’s always made the way we’d make it at home.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-join">
        <div className="landing-wrap">
          <p className="landing-eyebrow">Join us</p>
          <h2>Pull up a chair.</h2>
          <p>
            We cook for a limited number of families each week, so membership is by request. Tell us a little
            about your household and we’ll be in touch.
          </p>
          <button className="landing-btn landing-btn--light" onClick={onJoin}>Request to Join</button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-wrap">
          <img src="/Cream Horizontal Logo.png" alt="Dinner with Charles" />
          <div className="landing-footer-links">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram @dinnerwithcharles</a>
            <button className="landing-link" onClick={onSignIn}>Sign In</button>
            <small>© {new Date().getFullYear()} Dinner with Charles</small>
          </div>
        </div>
      </footer>
    </div>
  )
}
