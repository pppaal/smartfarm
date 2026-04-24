import { useEffect, useState, createContext, useContext } from 'react';
import { api } from '../lib/api.js';

const STORAGE_KEY = 'smartfarm_active_gh';
const Ctx = createContext(null);

export function GreenhouseProvider({ children }) {
  const [list, setList] = useState([]);
  const [activeId, setActiveId] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : null;
  });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const rows = await api('/greenhouses');
      setList(rows);
      if (rows.length > 0) {
        if (!activeId || !rows.find((g) => g.id === activeId)) {
          setActiveId(rows[0].id);
          localStorage.setItem(STORAGE_KEY, String(rows[0].id));
        }
      } else {
        setActiveId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const setActive = (id) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const active = list.find((g) => g.id === activeId) || null;

  return (
    <Ctx.Provider value={{ list, active, activeId, setActive, refresh, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGreenhouses() {
  const v = useContext(Ctx);
  if (!v) throw new Error('GreenhouseProvider missing');
  return v;
}

// 하위호환: 기존 useFirstGreenhouse 코드가 쓰는 { gh, err } 형태 유지
export function useFirstGreenhouse() {
  const { active } = useGreenhouses();
  return { gh: active, err: null };
}
