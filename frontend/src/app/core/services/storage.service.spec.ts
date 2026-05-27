import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('setToken / getToken', () => {
    it('devrait stocker et récupérer le token JWT', () => {
      service.setToken('my-jwt-token');
      expect(service.getToken()).toBe('my-jwt-token');
    });

    it('devrait retourner null si aucun token stocké', () => {
      expect(service.getToken()).toBeNull();
    });
  });

  describe('removeToken', () => {
    it('devrait supprimer le token après suppression', () => {
      service.setToken('to-be-removed');
      service.removeToken();
      expect(service.getToken()).toBeNull();
    });
  });

  describe('setItem / getItem', () => {
    it('devrait sérialiser un objet en JSON et le désérialiser correctement', () => {
      const user = { id: 1, email: 'test@portfolio.dev', role: 'ADMIN' };
      service.setItem('user', user);
      expect(service.getItem('user')).toEqual(user);
    });

    it('devrait retourner null si la clé est absente', () => {
      expect(service.getItem('absent-key')).toBeNull();
    });

    it('devrait retourner null si le JSON est corrompu', () => {
      localStorage.setItem('bad-json', '{not: json at all}');
      expect(service.getItem('bad-json')).toBeNull();
    });

    it('devrait stocker et récupérer un tableau', () => {
      const items = [1, 2, 3];
      service.setItem('numbers', items);
      expect(service.getItem<number[]>('numbers')).toEqual(items);
    });
  });

  describe('removeItem', () => {
    it('devrait supprimer une clé spécifique sans affecter les autres', () => {
      service.setItem('key-a', 'valeur-a');
      service.setItem('key-b', 'valeur-b');
      service.removeItem('key-a');
      expect(service.getItem('key-a')).toBeNull();
      expect(service.getItem<string>('key-b')).toBe('valeur-b');
    });
  });

  describe('clear', () => {
    it('devrait supprimer le token et la clé user', () => {
      service.setToken('jwt-token');
      service.setItem(service.userKey, { email: 'test@portfolio.dev' });

      service.clear();

      expect(service.getToken()).toBeNull();
      expect(service.getItem(service.userKey)).toBeNull();
    });

    it('ne devrait pas supprimer les clés autres que token et user', () => {
      service.setItem('autre-cle', { data: 'valeur' });
      service.setToken('jwt');

      service.clear();

      expect(service.getItem<{ data: string }>('autre-cle')).toEqual({ data: 'valeur' });
    });
  });

  describe('userKey', () => {
    it('devrait retourner la clé portfolio_user', () => {
      expect(service.userKey).toBe('portfolio_user');
    });
  });
});
