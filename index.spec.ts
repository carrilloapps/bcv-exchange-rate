import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { getBcvRates, getTrmRates } from './index';

const mock = new MockAdapter(axios);

describe('bcv-exchange-rate library', () => {
  afterEach(() => {
    mock.reset();
  });

  describe('getBcvRates', () => {
    it('should fetch and parse BCV rates successfully', async () => {
      const htmlMain = `
        <div id="dolar"><strong>48,16</strong></div>
        <div id="euro"><strong>51,20</strong></div>
        <span class="date-display-single" content="2026-04-21T00:00:00">21 de abril</span>
      `;
      const htmlHistory = `
        <table class="views-table">
          <tbody>
            <tr>
              <td>20-04-2026</td>
              <td>Banco de Prueba</td>
              <td>47,50</td>
              <td>48,50</td>
            </tr>
          </tbody>
        </table>
        <div class="pager-next">Next</div>
      `;

      mock.onGet('https://www.bcv.org.ve/').reply(200, htmlMain);
      mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, htmlHistory);

      const result = await getBcvRates({ days: 1, page: 1 });

      expect(result.current.USD).toBe(48.16);
      expect(result.current.EUR).toBe(51.2);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].bank).toBe('Banco de Prueba');
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should handle errors in historical data gracefully', async () => {
      const htmlMain = '<div id="dolar"><strong>48,16</strong></div>';
      mock.onGet('https://www.bcv.org.ve/').reply(200, htmlMain);
      mock.onGet(/tasas-informativas-sistema-bancario/).reply(500);

      const result = await getBcvRates();
      expect(result.current.USD).toBe(48.16);
      expect(result.history).toHaveLength(0);
    });

    it('should throw error if main site fails', async () => {
      mock.onGet('https://www.bcv.org.ve/').reply(500);
      await expect(getBcvRates()).rejects.toThrow('Error obteniendo tasas BCV');
    });
  });

  describe('getTrmRates', () => {
    it('should fetch and parse TRM rates successfully', async () => {
      const apiResponse = [
        { valor: "3573.30", unidad: "COP", vigenciahasta: "2026-04-21" },
        { valor: "3590.00", unidad: "COP", vigenciahasta: "2026-04-20" }
      ];

      mock.onGet(/datos.gov.co/).reply(200, apiResponse);

      const result = await getTrmRates();

      expect(result?.current.value).toBe(3573.3);
      expect(result?.history).toHaveLength(1);
      expect(result?.pagination.limit).toBe(10);
    });

    it('should return null for empty API response', async () => {
      mock.onGet(/datos.gov.co/).reply(200, []);
      const result = await getTrmRates();
      expect(result).toBeNull();
    });

    it('should throw error if API fails', async () => {
      mock.onGet(/datos.gov.co/).reply(500);
      await expect(getTrmRates()).rejects.toThrow('Error obteniendo TRM');
    });

    it('should handle edge cases in number parsing', async () => {
      mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>invalid</strong></div>');
      const result = await getBcvRates();
      expect(result.current.USD).toBeUndefined();
    });

    it('should handle incomplete table rows in BCV', async () => {
      mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
      mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, '<table><tbody><tr><td>Only Date</td></tr></tbody></table>');
      const result = await getBcvRates();
      expect(result.history).toHaveLength(0);
    });
  });
});
