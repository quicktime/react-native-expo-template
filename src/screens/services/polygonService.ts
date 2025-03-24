import axios from 'axios';
import { POLYGON_API_KEY } from '@env';

const BASE_URL = 'https://api.polygon.io';

// Types for stock data
export interface StockData {
  ticker: string;
  name?: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

// Types for option data
export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
}

export interface OptionData {
  symbol: string;
  underlyingSymbol: string;
  expirationDate: string;
  strikePrice: number;
  optionType: 'call' | 'put';
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  openInterest: number;
  volume: number;
  impliedVolatility: number;
  greeks: OptionGreeks;
}

// Types for historical data
export interface HistoricalPriceData {
  date: string;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
}

// Function to fetch current stock price
export const fetchStockPrice = async (symbol: string): Promise<StockData> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v2/aggs/ticker/${symbol}/prev?adjusted=true`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const change = result.c - result.o;
      const changePercent = (change / result.o) * 100;

      return {
        ticker: symbol,
        currentPrice: result.c,
        previousClose: result.o,
        change,
        changePercent
      };
    }
    
    throw new Error('No data available');
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    throw error;
  }
};

// Function to search for stocks by keyword or symbol
export const searchStocks = async (query: string): Promise<any[]> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&sort=ticker&order=asc&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    if (response.data.results) {
      return response.data.results.map((item: any) => ({
        symbol: item.ticker,
        name: item.name,
        market: item.market,
        primaryExchange: item.primary_exchange,
        type: item.type
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
};

// Function to fetch company details
export const fetchCompanyDetails = async (symbol: string): Promise<any> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v3/reference/tickers/${symbol}`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    if (response.data.results) {
      return {
        name: response.data.results.name,
        description: response.data.results.description,
        industry: response.data.results.sic_description,
        marketCap: response.data.results.market_cap,
        employees: response.data.results.total_employees,
        website: response.data.results.homepage_url,
        logoUrl: response.data.results.branding?.logo_url || null,
        address: response.data.results.address,
        exchange: response.data.results.primary_exchange,
        type: response.data.results.type
      };
    }
    
    throw new Error('No company details available');
  } catch (error) {
    console.error(`Error fetching company details for ${symbol}:`, error);
    throw error;
  }
};

// Function to fetch historical price data
export const fetchHistoricalPrices = async (
  symbol: string, 
  timespan: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day',
  from: string, 
  to: string,
  limit: number = 365
): Promise<HistoricalPriceData[]> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v2/aggs/ticker/${symbol}/range/1/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    if (response.data.results) {
      return response.data.results.map((item: any) => ({
        date: new Date(item.t).toISOString().split('T')[0],
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
};

// Function to fetch options data for a specific symbol
export const fetchOptionsData = async (
  underlyingSymbol: string,
  expirationDate?: string
): Promise<OptionData[]> => {
  try {
    // If no expiration date is provided, get the next expiration date
    let expDate = expirationDate;
    if (!expDate) {
      const expirations = await fetchOptionsExpirations(underlyingSymbol);
      if (expirations.length > 0) {
        expDate = expirations[0];
      } else {
        throw new Error('No expiration dates available');
      }
    }

    const response = await axios.get(
      `${BASE_URL}/v3/reference/options/contracts?underlying_ticker=${underlyingSymbol}&expiration_date=${expDate}`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      // Map API response to our OptionData interface
      return Promise.all(
        response.data.results.map(async (option: any) => {
          // Fetch additional data like last price and greeks
          const details = await fetchOptionDetails(option.ticker);
          
          return {
            symbol: option.ticker,
            underlyingSymbol: option.underlying_ticker,
            expirationDate: option.expiration_date,
            strikePrice: option.strike_price,
            optionType: option.contract_type.toLowerCase(),
            lastPrice: details.lastPrice || 0,
            bidPrice: details.bidPrice || 0,
            askPrice: details.askPrice || 0,
            openInterest: details.openInterest || 0,
            volume: details.volume || 0,
            impliedVolatility: details.impliedVolatility || 0,
            greeks: details.greeks || {
              delta: 0,
              gamma: 0,
              theta: 0,
              vega: 0
            }
          };
        })
      );
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching options data for ${underlyingSymbol}:`, error);
    throw error;
  }
};

// Function to fetch available expiration dates for options
export const fetchOptionsExpirations = async (
  underlyingSymbol: string
): Promise<string[]> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v3/reference/options/contracts?underlying_ticker=${underlyingSymbol}`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      // Extract unique expiration dates and sort them
      const expirationDates = response.data.results
        .map((option: any) => option.expiration_date)
        .filter((value: string, index: number, self: string[]) => 
          self.indexOf(value) === index
        )
        .sort();
      
      return expirationDates;
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching option expirations for ${underlyingSymbol}:`, error);
    throw error;
  }
};

// Function to fetch details for a specific option contract
const fetchOptionDetails = async (optionSymbol: string): Promise<any> => {
  try {
    // Fetch last trade
    const tradeResponse = await axios.get(
      `${BASE_URL}/v2/last/trade/${optionSymbol}`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    // Fetch snapshot for bid/ask and greeks
    const snapshotResponse = await axios.get(
      `${BASE_URL}/v3/snapshot/options/${optionSymbol}`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    const lastPrice = tradeResponse.data.results?.p || 0;
    
    // Extract data from snapshot response
    const snapshot = snapshotResponse.data.results;
    const details = {
      lastPrice,
      bidPrice: snapshot?.bid?.p || 0,
      askPrice: snapshot?.ask?.p || 0,
      openInterest: snapshot?.open_interest || 0,
      volume: snapshot?.day?.v || 0,
      impliedVolatility: snapshot?.implied_volatility || 0,
      greeks: {
        delta: snapshot?.greeks?.delta || 0,
        gamma: snapshot?.greeks?.gamma || 0,
        theta: snapshot?.greeks?.theta || 0,
        vega: snapshot?.greeks?.vega || 0,
        rho: snapshot?.greeks?.rho || 0
      }
    };
    
    return details;
  } catch (error) {
    console.error(`Error fetching option details for ${optionSymbol}:`, error);
    // Return default values if there's an error
    return {
      lastPrice: 0,
      bidPrice: 0,
      askPrice: 0,
      openInterest: 0,
      volume: 0,
      impliedVolatility: 0,
      greeks: {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
      }
    };
  }
};

// Function to fetch market status
export const fetchMarketStatus = async (): Promise<any> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v1/marketstatus/now`,
      {
        headers: {
          'Authorization': `Bearer ${POLYGON_API_KEY}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching market status:', error);
    return {
      market: 'closed',
      serverTime: new Date().toISOString(),
      exchanges: {
        nasdaq: 'closed',
        nyse: 'closed',
        otc: 'closed'
      },
      currencies: {
        fx: 'closed',
        crypto: 'open'
      }
    };
  }
};