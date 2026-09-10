<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Form;

final class ReplayTest extends TestCase
{
	/** @return iterable<string, array{string}> */
	public static function fixtures(): iterable
	{
		foreach (glob(__DIR__ . '/fixtures/*.json') ?: [] as $path) {
			yield basename($path, '.json') => [$path];
		}
	}

	#[DataProvider('fixtures')]
	public function testWhatTheClientPostsIsAccepted(string $path): void
	{
		$fixture = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
		$html = (string) file_get_contents(__DIR__ . '/../..' . $fixture['page']);
		$files = [];
		foreach ($fixture['files'] as $field => $entry) {
			$files[$field] = count($entry['name']) === 1
				? array_map(fn ($list) => $list[0], $entry)
				: $entry;
		}
		$result = Form::parse($html)->validate($fixture['payload'], $files, null, \WebSanity\FormSanity\Unknown::Ignore);
		self::assertTrue($result->isValid(), json_encode($result->errors()));
	}
}
