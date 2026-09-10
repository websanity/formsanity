<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Types;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Types\Validator;

final class VectorsTest extends TestCase
{
	/** @return iterable<string, array{string, string, ?string, string}> */
	public static function vectors(): iterable
	{
		$entries = json_decode((string) file_get_contents(__DIR__ . '/../../../vectors/validators.json'), true, flags: JSON_THROW_ON_ERROR);
		foreach ($entries as $index => $entry) {
			$label = sprintf('%d %s %s', $index, $entry['type'], json_encode($entry['value']));
			yield $label => [$entry['type'], $entry['value'], $entry['param'] ?? null, $entry['expected']];
		}
	}

	#[DataProvider('vectors')]
	public function testVector(string $type, string $value, ?string $param, string $expected): void
	{
		self::assertSame($expected, Validator::check($type, $value, $param)->value);
	}
}
