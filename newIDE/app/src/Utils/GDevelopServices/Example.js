// @flow
import axios from 'axios';
import { GDevelopAssetApi } from './ApiConfigs';
import { type Filters } from './Filters';
import { type UserPublicProfile } from './User';
import { retryIfFailed } from '../RetryIfFailed';

export type ExampleShortHeader = {|
  id: string,
  slug: string,
  name: string,
  shortDescription: string,
  description: string,
  license: string,
  tags: Array<string>,
  authors?: Array<UserPublicProfile>,
  authorIds?: Array<string>,
  previewImageUrls: Array<string>,
  gdevelopVersion: string,
  codeSizeLevel: string,
  difficultyLevel?: string,
  linkedExampleShortHeaders?: Array<{ slug: string, relation: string }>,
|};

export type Example = {|
  ...ExampleShortHeader,
  projectFileUrl: string,
  authors: Array<string>,
|};

export type AllExamples = {|
  exampleShortHeaders: Array<ExampleShortHeader>,
  filters: Filters,
|};

const PUBLIC_EXAMPLES_DATABASE =
  'https://resources.gdevelop-app.com/examples-database';

const getLegacyExamples = async (): Promise<AllExamples> => {
  const response = await axios.get(`${GDevelopAssetApi.baseUrl}/example`, {
    params: { environment: 'live' },
  });
  const { exampleShortHeadersUrl, filtersUrl } = response.data;
  const [exampleShortHeaders, filters] = await Promise.all([
    axios.get(exampleShortHeadersUrl).then(result => result.data),
    axios.get(filtersUrl).then(result => result.data),
  ]);
  return { exampleShortHeaders, filters };
};

const getPublicExamples = async (baseUrl: string): Promise<AllExamples> => {
  const [exampleShortHeaders, filters] = await Promise.all([
    retryIfFailed({ times: 2 }, async () => {
      const result = await axios.get(`${baseUrl}/exampleShortHeaders.json`);
      return result.data;
    }),
    retryIfFailed({ times: 2 }, async () => {
      const result = await axios.get(`${baseUrl}/filters.json`);
      return result.data;
    }),
  ]);
  if (!Array.isArray(exampleShortHeaders) || !exampleShortHeaders.length) {
    throw new Error('The public example catalog is empty.');
  }
  return { exampleShortHeaders, filters };
};

export const listAllExamples = async (): Promise<AllExamples> => {
  try {
    return await getPublicExamples('./examples-database');
  } catch (error) {
    try {
      return await getPublicExamples(PUBLIC_EXAMPLES_DATABASE);
    } catch (secondError) {
      return getLegacyExamples();
    }
  }
};

export const getExample = async (
  exampleShortHeader: ExampleShortHeader
): Promise<Example> => {
  try {
    const result = await axios.get(
      `${PUBLIC_EXAMPLES_DATABASE}/examples/${encodeURIComponent(
        exampleShortHeader.id
      )}.json`
    );
    return result.data;
  } catch (error) {
    const response = await axios.get(
      `${GDevelopAssetApi.baseUrl}/example-v2/${exampleShortHeader.id}`
    );
    return response.data;
  }
};

export const getUserExampleShortHeaders = async (
  authorId: string
): Promise<Array<ExampleShortHeader>> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await axios.get(
    `${GDevelopAssetApi.baseUrl}/example-short-header`,
    {
      params: {
        authorId,
      },
    }
  );

  return response.data;
};
