import React from 'react';
import { motion } from 'framer-motion';

interface AuraProps {
  isActive: boolean;
  type: 'calm' | 'focus' | 'alert';
}

const Aura: React.FC<AuraProps> = ({ isActive, type }) => {
  if (!isActive) return null;

  // Configuración de colores según el tipo
  const auraConfig = {
    calm: {
      color: 'rgba(76, 175, 80, 0.3)', // Verde
      glowColor: '#4ade80',
      duration: 4
    },
    focus: {
      color: 'rgba(96, 165, 250, 0.3)', // Azul
      glowColor: '#60a5fa',
      duration: 3
    },
    alert: {
      color: 'rgba(251, 191, 36, 0.3)', // Amarillo
      glowColor: '#fbbf24',
      duration: 2
    }
  };

  const config = auraConfig[type];

  return (
    <motion.div
      className="aura-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 9999
      }}
    >
      {/* Borde superior */}
      <motion.div
        animate={{
          boxShadow: [
            `inset 0 15px 30px ${config.color}`,
            `inset 0 20px 50px ${config.color}`,
            `inset 0 15px 30px ${config.color}`
          ]
        }}
        transition={{
          duration: config.duration,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100px',
          background: `linear-gradient(to bottom, ${config.color}, transparent)`
        }}
      />

      {/* Borde izquierdo */}
      <motion.div
        animate={{
          boxShadow: [
            `inset 15px 0 30px ${config.color}`,
            `inset 20px 0 50px ${config.color}`,
            `inset 15px 0 30px ${config.color}`
          ]
        }}
        transition={{
          duration: config.duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '100px',
          background: `linear-gradient(to right, ${config.color}, transparent)`
        }}
      />

      {/* Borde derecho */}
      <motion.div
        animate={{
          boxShadow: [
            `inset -15px 0 30px ${config.color}`,
            `inset -20px 0 50px ${config.color}`,
            `inset -15px 0 30px ${config.color}`
          ]
        }}
        transition={{
          duration: config.duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100px',
          background: `linear-gradient(to left, ${config.color}, transparent)`
        }}
      />

      {/* Borde inferior */}
      <motion.div
        animate={{
          boxShadow: [
            `inset 0 -15px 30px ${config.color}`,
            `inset 0 -20px 50px ${config.color}`,
            `inset 0 -15px 30px ${config.color}`
          ]
        }}
        transition={{
          duration: config.duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '100px',
          background: `linear-gradient(to top, ${config.color}, transparent)`
        }}
      />
    </motion.div>
  );
};

export default Aura;