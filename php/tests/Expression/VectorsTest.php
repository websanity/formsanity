<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Expression;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Expression\Context;
use WebSanity\FormSanity\Expression\Parser;

final class VectorsTest extends TestCase
{
	/** @return iterable<string, array{string, array<string, string>, array<string, string>, array<string, bool>, bool}> */
	public static function vectors(): iterable
	{
		$entries = json_decode((string) file_get_contents(__DIR__ . '/../../../vectors/expressions.json'), true, flags: JSON_THROW_ON_ERROR);
		foreach ($entries as $index => $entry) {
			$label = sprintf('%d %s %s', $index, $entry['expr'], json_encode($entry['fields']));
			yield $label => [$entry['expr'], $entry['fields'], $entry['types'] ?? [], $entry['valid'] ?? [], $entry['expected']];
		}
	}

	#[DataProvider('vectors')]
	public function testVector(string $expr, array $fields, array $types, array $valid, bool $expected): void
	{
		$context = new class ($fields, $types, $valid) implements Context {
			public function __construct(private array $fields, private array $types, private array $valid) {}
			public function get(string $name): string { return $this->fields[$name] ?? ''; }
			public function typeOf(string $name): ?string { return $this->types[$name] ?? null; }
			public function valid(string $name): bool { return $this->valid[$name] ?? true; }
		};
		self::assertSame($expected, Parser::parse($expr)->evaluate($context));
	}
}
