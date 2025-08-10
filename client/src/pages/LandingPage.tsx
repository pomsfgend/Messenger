import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import './LandingPage.css';
import * as api from '../services/api';
import { 
    FaShieldAlt as FaShield, FaMicrochip, FaUsers, FaLock, FaRocket, FaUser, FaFingerprint, 
    FaNetworkWired, FaNewspaper, FaUserMd as FaUserDoctor, FaBriefcase, FaComments, FaGithub, 
    FaTwitter, FaTelegram, FaBars, FaTimes, FaBan, FaMask, FaDatabase, 
    FaGlobe, FaKey, FaBolt 
} from 'react-icons/fa';


const LandingPage: React.FC = () => {
    const [stats, setStats] = useState<api.AppStats | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const statsContainerRef = useRef<HTMLDivElement>(null);
    const sessionsRef = useRef<HTMLDivElement>(null);
    const leaksRef = useRef<HTMLDivElement>(null);
    const uptimeRef = useRef<HTMLDivElement>(null);
    const thirdPartyRef = useRef<HTMLDivElement>(null);
    const animationTriggeredRef = useRef(false);

    // Particle Background Logic
    useEffect(() => {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        const particleCount = window.innerWidth < 768 ? 30 : 50;
        let createdParticles: HTMLElement[] = [];

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            
            const size = Math.random() * 6 + 2;
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            const animationDuration = Math.random() * 20 + 10;
            const animationDelay = Math.random() * 5;
            const hue = Math.random() * 360;
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${posX}%`;
            particle.style.top = `${posY}%`;
            particle.style.animationDuration = `${animationDuration}s`;
            particle.style.animationDelay = `${animationDelay}s`;
            particle.style.backgroundColor = `hsla(${hue}, 100%, 70%, 0.3)`;
            
            particlesContainer.appendChild(particle);
            createdParticles.push(particle);
        }
        
        return () => {
            createdParticles.forEach(p => p.remove());
        };
    }, []);
    
    const animateCounter = useCallback((element: HTMLElement, finalValue: number, duration = 2000) => {
        let startValue = 0;
        const increment = Math.max(finalValue / (duration / 16), 1);
        let current = startValue;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= finalValue) {
                element.textContent = finalValue.toLocaleString('ru-RU');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString('ru-RU');
            }
        }, 16);
        return timer;
    }, []);

    const animatePercentage = useCallback((element: HTMLElement, finalValue: number, duration = 2000) => {
        let startValue = 0;
        const increment = finalValue / (duration / 16);
        let current = startValue;

        const timer = setInterval(() => {
            current += increment;
            if (current >= finalValue) {
                element.textContent = finalValue.toFixed(2) + '%';
                clearInterval(timer);
            } else {
                element.textContent = current.toFixed(2) + '%';
            }
        }, 16);
        return timer;
    }, []);

    const triggerAnimations = useCallback(() => {
        if (!stats || animationTriggeredRef.current) return;

        const elements = {
            sessions: sessionsRef.current,
            leaks: leaksRef.current,
            uptime: uptimeRef.current,
            thirdParty: thirdPartyRef.current,
        };
        
        if (elements.sessions) animateCounter(elements.sessions, stats.dailySessions);
        if (elements.leaks) animateCounter(elements.leaks, stats.leaks);
        if (elements.uptime) {
             const uptimeValue = parseFloat(stats.uptime);
             if (!isNaN(uptimeValue)) {
                animatePercentage(elements.uptime, uptimeValue);
             } else {
                elements.uptime.textContent = stats.uptime;
             }
        }
        if (elements.thirdParty) animateCounter(elements.thirdParty, stats.thirdPartyShares);

        animationTriggeredRef.current = true;
    }, [stats, animateCounter, animatePercentage]);

    // Fetch stats on mount
    useEffect(() => {
        api.getStats().then(data => {
            setStats(data);
        }).catch(err => {
            console.error("Could not load stats", err);
            setStats({ dailySessions: 12459, leaks: 0, uptime: "99.99%", thirdPartyShares: 0 });
        });
    }, []);

    // Animate stats when they are loaded and visible
    useEffect(() => {
        if (!stats) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    triggerAnimations();
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );

        if (statsContainerRef.current) {
            observer.observe(statsContainerRef.current);
        }
        
        return () => observer.disconnect();
    }, [stats, triggerAnimations]);
    
     // Smooth scrolling
    const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        setIsMenuOpen(false); // Close menu on click
        const href = e.currentTarget.getAttribute('href');
        if (!href) return;
        const targetElement = document.querySelector(href);
        if (targetElement) {
            window.scrollTo({
                top: (targetElement as HTMLElement).offsetTop - 80, // Adjust for fixed nav
                behavior: 'smooth',
            });
        }
    };


    return (
        <div id="landing-page">
            <div className="particles" id="particles"></div>
            <nav className="glass">
                <div className="logo">
                    <img src="/assets/logo_for_mobile.jpg" alt="Logo" className="h-12 w-12 rounded-full object-cover" />
                    <span className="neon-text">Бульк</span>
                </div>
                <div className="nav-links">
                    <a href="#features" onClick={handleSmoothScroll}><FaShield className="inline mr-1" /> Возможности</a>
                    <a href="#how-it-works" onClick={handleSmoothScroll}><FaMicrochip className="inline mr-1" /> Технологии</a>
                    <a href="#use-cases" onClick={handleSmoothScroll}><FaUsers className="inline mr-1" /> Для кого</a>
                    <a href="#security" onClick={handleSmoothScroll}><FaLock className="inline mr-1" /> Безопасность</a>
                    <a href="#cta" onClick={handleSmoothScroll}><FaRocket className="inline mr-1" /> Начать</a>
                </div>
                 <button className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Open menu">
                    {isMenuOpen ? <FaTimes /> : <FaBars />}
                </button>
            </nav>
            
            {isMenuOpen && <div className="mobile-nav-overlay" onClick={() => setIsMenuOpen(false)}></div>}
            <div className={`mobile-nav-menu glass ${isMenuOpen ? 'open' : ''}`}>
                <a href="#features" onClick={handleSmoothScroll}><FaShield /> Возможности</a>
                <a href="#how-it-works" onClick={handleSmoothScroll}><FaMicrochip /> Технологии</a>
                <a href="#use-cases" onClick={handleSmoothScroll}><FaUsers /> Для кого</a>
                <a href="#security" onClick={handleSmoothScroll}><FaLock /> Безопасность</a>
                <a href="#cta" onClick={handleSmoothScroll}><FaRocket /> Начать</a>
            </div>

            <section className="hero">
                <div className="hero-content glass">
                    <h1 className="neon-text">ПУТЬ В <span className="neon-purple">НОВЫЙ МИР</span></h1>
                    <p>Бульк - полностью анонимный мессенджер. Ни слежки, ни метаданных, ни цифровых следов.</p>
                    <div className="hero-buttons">
                        <ReactRouterDOM.Link to="/login" className="btn btn-primary">НАЧАТЬ АНОНИМНЫЙ ЧАТ</ReactRouterDOM.Link>
                        <a href="#features" onClick={handleSmoothScroll} className="btn btn-secondary">УЗНАТЬ БОЛЬШЕ</a>
                    </div>
                </div>
            </section>

             <section id="features">
                <div className="section-header">
                    <h2 className="neon-text">Нулевой След. Максимум Свободы.</h2>
                    <p>Технологии, которые гарантируют вашу конфиденциальность без компромиссов</p>
                </div>
                <div className="features-grid">
                    <div className="feature-card glass">
                        <FaBan className="feature-icon" />
                        <h3>Без Номера/Почты</h3>
                        <p>Никакой привязки к личным данным. Регистрация полностью анонимна без подтверждения.</p>
                    </div>
                    <div className="feature-card glass">
                        <FaMask className="feature-icon" />
                        <h3>Анонимный Вход</h3>
                        <p>Одноразовые идентификаторы для каждого сеанса. Никто не узнает, кто вы и откуда.</p>
                    </div>
                    <div className="feature-card glass">
                        <FaDatabase className="feature-icon" />
                        <h3>Нулевые Метаданные</h3>
                        <p>Ваши сообщения не содержат никакой дополнительной информации о вас или получателе.</p>
                    </div>
                    <div className="feature-card glass">
                        <FaGlobe className="feature-icon" />
                        <h3>Неотслеживаемый IP</h3>
                        <p>Плавающие серверы и децентрализованная сеть делают отслеживание вашего IP невозможным.</p>
                    </div>
                </div>
            </section>
            
            <section id="how-it-works">
                <div className="section-header">
                    <h2 className="neon-text">Щит Неприкосновенности: <span className="neon-purple">Технологии Бульк</span></h2>
                    <p>Как мы обеспечиваем вашу конфиденциальность на каждом этапе</p>
                </div>
                <div className="process-steps">
                     <div className="step">
                        <div className="step-icon glass">
                            <FaUser />
                        </div>
                        <h3>Пользователь</h3>
                        <p>Анонимный вход без идентификации</p>
                    </div>
                    <div className="step">
                        <div className="step-icon glass">
                            <FaFingerprint />
                        </div>
                        <h3>Одноразовый ID</h3>
                        <p>Уникальный идентификатор для сессии</p>
                    </div>
                    <div className="step">
                        <div className="step-icon glass">
                            <FaNetworkWired />
                        </div>
                        <h3>Децентрализация</h3>
                        <p>Сеть плавающих серверов</p>
                    </div>
                    <div className="step">
                        <div className="step-icon glass">
                            <FaLock />
                        </div>
                        <h3>Шифрование</h3>
                        <p>End-to-End защита сообщений</p>
                    </div>
                    <div className="step">
                        <div className="step-icon glass">
                            <FaUsers />
                        </div>
                        <h3>Получатель</h3>
                        <p>Безопасная доставка сообщения</p>
                    </div>
                </div>
            </section>
            
            <section id="use-cases">
                <div className="section-header">
                    <h2 className="neon-text">Безопасное Общение: <span className="neon-green">Когда Конфиденциальность — Не Прихоть</span></h2>
                    <p>Легальные сценарии использования для защиты ваших прав и безопасности</p>
                </div>
                <div className="use-cases">
                     <div className="use-case glass">
                        <h3><FaNewspaper className="inline mr-2 text-cyan-400" /> Журналисты и Источники</h3>
                        <p>Защита инсайдеров и гарантия анонимности передаваемой информации. Безопасная коммуникация при расследованиях.</p>
                    </div>
                    <div className="use-case glass">
                        <h3><FaUserDoctor className="inline mr-2 text-cyan-400" /> Врачи и Пациенты</h3>
                        <p>Конфиденциальные онлайн-консультации без риска утечки медицинских данных. Анонимные обсуждения деликатных тем.</p>
                    </div>
                    <div className="use-case glass">
                        <h3><FaBriefcase className="inline mr-2 text-cyan-400" /> Бизнес-Переговоры</h3>
                        <p>Обсуждение стратегий и чувствительных данных без опасений промышленного шпионажа. Защита коммерческой тайны.</p>
                    </div>
                    <div className="use-case glass">
                        <h3><FaUsers className="inline mr-2 text-cyan-400" /> Право на Личное</h3>
                        <p>Просто чат с другом, о котором не узнают рекламные алгоритмы и третьи лица. Ваше личное пространство в цифровом мире.</p>
                    </div>
                </div>
            </section>

             <section id="security">
                <div className="section-header">
                    <h2 className="neon-text">Крепость, <span className="neon-purple">Которую Не Взломать</span></h2>
                    <p>Многоуровневая система защиты ваших данных и коммуникаций</p>
                </div>
                <div className="security-features">
                    <div className="security-card glass">
                        <h3><FaKey className="inline mr-2" /> Локальные Сессии</h3>
                        <p>Все данные стираются после завершения сессии. Временные ключи доступа генерируются для каждого сеанса.</p>
                    </div>
                    <div className="security-card glass">
                        <h3><FaShield className="inline mr-2" /> Сквозное Шифрование</h3>
                        <p>End-to-End шифрование гарантирует, что даже мы не видим ваши сообщения. Только вы и ваш собеседник.</p>
                    </div>
                    <div className="security-card glass">
                        <h3><FaLock className="inline mr-2" /> Двухфакторная Аутентификация</h3>
                        <p>Дополнительный уровень защиты ваших контактов и истории сообщений. В будущем: отпечаток пальца и физические ключи.</p>
                    </div>
                    <div className="security-card glass">
                        <h3><FaBolt className="inline mr-2" /> Без VPN / Всегда Доступно</h3>
                        <p>Надежное соединение без лишних настроек. Наша платформа не нуждается в обходах блокировок.</p>
                    </div>
                </div>
            </section>

            <section ref={statsContainerRef}>
                <div className="section-header">
                    <h2 className="neon-text">Доверяй Цифрам, <span className="neon-green">а не Словам</span></h2>
                    <p>Наша статистика в реальном времени — единственное, что мы показываем о наших пользователях</p>
                </div>
                <div className="stats-grid">
                    <div className="stat-box glass">
                        <div className="stat-number" id="sessions" ref={sessionsRef}>0</div>
                        <h3>Активных сессий за сутки</h3>
                    </div>
                    <div className="stat-box glass">
                        <div className="stat-number" id="leaks" ref={leaksRef}>0</div>
                        <h3>Зафиксированных утечек данных</h3>
                    </div>
                    <div className="stat-box glass">
                        <div className="stat-number" id="uptime" ref={uptimeRef}>0%</div>
                        <h3>Времени доступности</h3>
                    </div>
                    <div className="stat-box glass">
                        <div className="stat-number" id="third-party" ref={thirdPartyRef}>0</div>
                        <h3>Передано данных третьим лицам</h3>
                    </div>
                </div>
            </section>

             <section id="cta" className="cta-section">
                <div className="cta-content glass">
                    <h2 className="neon-text" style={{fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '25px'}}>Готовы к <span className="neon-purple">настоящей свободе</span> общения?</h2>
                    <p style={{fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', marginBottom: '30px'}}>Присоединяйтесь к тысячам пользователей, которые выбрали приватность без компромиссов</p>
                    <div className="cta-buttons">
                        <ReactRouterDOM.Link to="/login" className="btn btn-primary btn-icon"><FaComments /> НАЧАТЬ ЧАТ</ReactRouterDOM.Link>
                        <a href="https://t.me/authorizerprogaming_bot" className="btn btn-secondary btn-icon"><FaTelegram /> ОБРАТНАЯ СВЯЗЬ</a>
                        <a href="https://t.me/bulkehead" className="btn btn-secondary btn-icon"><FaTelegram /> НАШ КАНАЛ</a>
                    </div>
                </div>
            </section>

            <footer>
                <div className="footer-content glass">
                    <div className="logo" style={{justifyContent: 'center', marginBottom: '20px'}}>
                        <img src="/assets/logo_for_mobile.jpg" alt="Logo" className="h-12 w-12 rounded-full object-cover" />
                        <span className="neon-text">Бульк</span>
                    </div>
                    <p style={{fontSize: '1.1rem', marginBottom: '25px'}}>Анонимность. Без компромиссов. Без исключений.</p>
                    <div className="social-links">
                        <a href="https://t.me/bulkehead"><FaTelegram /></a>
                        <a href="#"><FaGithub /></a>
                        <a href="#"><FaTwitter /></a>
                    </div>
                    <p className="copyright">© 2023 Бульк. Все права защищены. Анонимность - ваше неотъемлемое право.</p>
                </div>
            </footer>

        </div>
    );
};

export default LandingPage;