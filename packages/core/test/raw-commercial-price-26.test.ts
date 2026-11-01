import {describe,it,expect} from 'vitest';
import {extractRawCommercialPrices} from '../src/agents/raw-commercial-price';
describe('source-first commercial extraction',()=>{
  it('extracts official single price without MMV naming',()=>{
    expect(extractRawCommercialPrices('<h1>ORA 5</h1><p>Preço único: R$ 165.990,00</p>')[0])
      .toMatchObject({amount:'165990.00',label:'SINGLE_PRICE'});
  });
  it('does not mistake bonus or model number for vehicle MSRP',()=>{
    expect(extractRawCommercialPrices('Tank 300 Bônus promocional de R$ 20.000,00')).toHaveLength(0);
    expect(extractRawCommercialPrices('Preço único: R$ 300,00')).toHaveLength(0);
  });
  it('keeps advertised and promotion amounts distinct',()=>{
    const x=extractRawCommercialPrices('Preço público sugerido: R$ 194.990,00. Bônus de R$ 20.000,00. Por R$ 174.990,00');
    expect(x.map(v=>v.amount)).toEqual(['194990.00','174990.00']);
  });
});
