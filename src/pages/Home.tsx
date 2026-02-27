import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, QrCode } from 'lucide-react';
import { motion } from 'motion/react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <section className="bg-primary text-primary-foreground py-20 px-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl font-bold mb-6">PrimePickle</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            The ultimate lobby-first pickleball matchmaking platform. 
            Join games, track your MMR, and compete with integrity.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="font-bold">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-primary">
                Log In
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-primary">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Users, title: "1. Register", desc: "Create your profile and get your initial MMR." },
            { icon: QrCode, title: "2. Find Lobby", desc: "Locate a local game or event near you." },
            { icon: Trophy, title: "3. Scan & Play", desc: "Scan the lobby QR code to join and compete." }
          ].map((item, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="text-center h-full border-t-4 border-t-accent">
                <CardHeader>
                  <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                    <item.icon className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6 text-primary">Fair & Competitive</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Our Elo-based MMR system ensures you always play against opponents of similar skill levels. 
              Win matches to climb the ranks and prove your dominance on the court.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span>Real-time MMR updates</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span>QR-code instant lobby joining</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span>Detailed match history</span>
              </li>
            </ul>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-xl rotate-2 hover:rotate-0 transition-transform duration-500">
            <div className="flex items-center justify-between mb-8 border-b pb-4">
              <div>
                <div className="text-sm text-muted-foreground">Current MMR</div>
                <div className="text-4xl font-bold text-primary">1250</div>
              </div>
              <Trophy className="w-12 h-12 text-accent" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium">Victory vs Team B</span>
                <span className="text-green-600 font-bold">+20</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="font-medium">Defeat vs Team A</span>
                <span className="text-red-600 font-bold">-15</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
