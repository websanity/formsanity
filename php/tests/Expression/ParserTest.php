<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Expression;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\AuthoringError;
use WebSanity\FormSanity\Expression\Parser;

final class ParserTest extends TestCase
{
	/** @return iterable<string, array{string}> */
	public static function syntaxErrors(): iterable
	{
		yield 'single equals' => ["contact = 'phone'"];
		yield 'triple equals' => ["contact === 'phone'"];
		yield 'chained comparison' => ['a < b < c'];
		yield 'unterminated string' => ["name == 'O'Brien"];
		yield 'unbalanced parenthesis' => ["(a == 'x'"];
		yield 'trailing input' => ["a == 'x' b"];
		yield 'unknown function' => ['count(a)'];
		yield 'double quotes outside a string' => ['a == "x"'];
	}

	#[DataProvider('syntaxErrors')]
	public function testASyntaxErrorIsAnAuthoringError(string $source): void
	{
		$this->expectException(AuthoringError::class);
		Parser::parse($source);
	}

	public function testDependenciesAreTheDistinctFieldNames(): void
	{
		$compiled = Parser::parse("(a == 'x' && b == 'y') || a == 'z' || valid(c)");
		$deps = $compiled->dependencies;
		sort($deps);
		self::assertSame(['a', 'b', 'c'], $deps);
	}

	public function testABareValidIsAFieldName(): void
	{
		$compiled = Parser::parse("valid == 'yes'");
		self::assertSame(['valid'], $compiled->dependencies);
	}

	public function testAnAuthoringErrorMessageStaysJsonSafe(): void
	{
		try {
			Parser::parse("a == \xC3");
			self::fail('Expected an AuthoringError');
		} catch (AuthoringError $error) {
			self::assertNotFalse(json_encode($error->getMessage()));
		}
	}
}
